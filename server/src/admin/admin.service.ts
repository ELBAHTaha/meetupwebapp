import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { publicUser, userPublicInclude } from '../common/serializers/user.serializer';
import { eventInclude, serializeEvent } from '../common/serializers/event.serializer';
import { BusinessService } from '../monetization/business.service';
import { ExpressPaymentService } from '../monetization/express-payment.service';
import { hashContact } from '../auth/auth.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly businesses: BusinessService,
    private readonly expressPayments: ExpressPaymentService,
  ) {}

  async overview(): Promise<{ openReports: number; flaggedUsers: number; liveToday: number }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000);

    const [openReports, flagged, liveToday] = await Promise.all([
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.flaggedUsers(),
      this.prisma.event.count({
        where: { status: 'LIVE', startsAt: { gte: startOfDay, lt: endOfDay } },
      }),
    ]);
    return { openReports, flaggedUsers: flagged.length, liveToday };
  }

  /** trust < 2.5, flags from ≥2 distinct events, or ≥2 reports. */
  async flaggedUsers(): Promise<{ user: unknown; reportCount: number }[]> {
    const candidates = await this.prisma.user.findMany({
      where: { OR: [{ trustScore: { lt: 2.5 } }, { flagCount: { gte: 2 } }] },
      include: userPublicInclude,
    });
    const reportCounts = await this.prisma.report.groupBy({
      by: ['targetUserId'],
      where: { targetType: 'USER', targetUserId: { not: null } },
      _count: { _all: true },
    });
    const reportMap = new Map(reportCounts.map((r) => [r.targetUserId, r._count._all]));

    // Also pull in users with ≥3 reports who aren't already candidates.
    const reportedIds = reportCounts.filter((r) => r._count._all >= 3).map((r) => r.targetUserId as string);
    const extraIds = reportedIds.filter((id) => !candidates.some((c) => c.id === id));
    const extra = extraIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: extraIds } }, include: userPublicInclude })
      : [];

    return [...candidates, ...extra]
      .map((u) => ({ user: publicUser(u), reportCount: reportMap.get(u.id) ?? 0 }))
      .sort((a, b) => (a.user as any).trustScore - (b.user as any).trustScore);
  }

  async reports(): Promise<unknown[]> {
    const reports = await this.prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { include: userPublicInclude },
        targetUser: { include: userPublicInclude },
        targetEvent: { include: eventInclude },
        chatThread: {
          include: { messages: { orderBy: { sentAt: 'asc' }, include: { sender: { select: { name: true } } } } },
        },
      },
    });

    return reports.map((r) => ({
      id: r.id,
      reporterId: r.reporterId,
      targetType: r.targetType === 'USER' ? 'user' : 'activity',
      targetId: r.targetUserId ?? r.targetEventId ?? '',
      reason: r.reason,
      chatThreadId: r.chatThreadId ?? undefined,
      status: r.status.toLowerCase(),
      createdAt: r.createdAt.toISOString(),
      reporter: publicUser(r.reporter),
      targetUser: r.targetUser ? publicUser(r.targetUser) : undefined,
      targetEvent: r.targetEvent ? serializeEvent(r.targetEvent) : undefined,
      thread: r.chatThread
        ? {
            id: r.chatThread.id,
            messages: r.chatThread.messages.map((m) => ({
              id: m.id,
              senderId: m.senderId,
              senderName: m.sender.name,
              text: m.text,
              sentAt: m.sentAt.toISOString(),
            })),
          }
        : null,
    }));
  }

  async subscribers(): Promise<unknown[]> {
    const users = await this.prisma.user.findMany({
      where: { OR: [{ subscriptionPlan: { not: 'FREE' } }, { isPremiumUser: true }] },
      include: userPublicInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return users.map((u) => ({
      user: publicUser(u),
      plan: u.subscriptionPlan.toLowerCase(),
      status: u.subscriptionStatus.toLowerCase(),
      endsAt: u.subscriptionEndsAt?.toISOString() ?? null,
      isPremiumUser: u.isPremiumUser,
      premiumUntil: u.premiumUntil?.toISOString() ?? null,
      cardLastFour: u.cardLastFour,
      creditAmountCents: u.creditAmountCents,
    }));
  }

  /** Activities awaiting first approval (created by normal users). */
  async pendingActivities(): Promise<unknown[]> {
    const events = await this.prisma.event.findMany({
      where: { approvedAt: null, status: 'LIVE' },
      include: eventInclude,
      orderBy: { createdAt: 'asc' },
    });
    return events.map((e) => serializeEvent(e));
  }

  async approveActivity(id: string): Promise<{ success: true }> {
    const e = await this.prisma.event.update({ where: { id }, data: { approvedAt: new Date() } });
    await this.notifications.push({
      userId: e.hostId,
      type: 'confirmed',
      title: 'Your activity is approved 🎉',
      body: `“${e.title}” is now live in the feed.`,
      eventId: e.id,
    });
    return { success: true };
  }

  async rejectActivity(id: string): Promise<{ success: true }> {
    const e = await this.prisma.event.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.notifications.push({
      userId: e.hostId,
      type: 'admin',
      title: 'Activity not approved',
      body: `“${e.title}” wasn’t approved by the team.`,
      eventId: e.id,
    });
    return { success: true };
  }

  /** Activities hidden pending review (auto-hidden when reported). */
  async underReviewActivities(): Promise<unknown[]> {
    const events = await this.prisma.event.findMany({
      where: { underReview: true },
      include: eventInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return events.map((e) => serializeEvent(e));
  }

  /** Clear the review hold so the activity is visible again. */
  async restoreActivity(id: string): Promise<{ success: true }> {
    await this.prisma.event.update({ where: { id }, data: { underReview: false } });
    return { success: true };
  }

  businessesList(): Promise<unknown[]> {
    return this.businesses.adminBusinesses();
  }

  approveBusiness(id: string): Promise<unknown> {
    return this.businesses.approveBusiness(id);
  }

  expressPaymentsList(): Promise<unknown[]> {
    return this.expressPayments.pendingPaidActivities();
  }

  async resolveReport(id: string, adminId: string): Promise<{ success: true }> {
    await this.prisma.report.update({ where: { id }, data: { status: 'RESOLVED', resolvedById: adminId } });
    return { success: true };
  }

  // --- moderation actions -------------------------------------------------
  private async ensureUser(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, include: userPublicInclude });
    if (!u) throw new NotFoundException('User not found.');
    return u;
  }

  async warn(adminId: string, userId: string, note?: string): Promise<unknown> {
    const u = await this.ensureUser(userId);
    await this.prisma.moderationAction.create({ data: { adminId, targetUserId: userId, action: 'WARN', note } });
    await this.notifications.push({
      userId,
      type: 'admin',
      title: 'A note from the Jmaâ team',
      body: note || 'You’ve received a warning following a report. Please review our community guidelines.',
    });
    return publicUser(await this.ensureUser(userId));
  }

  async suspend(adminId: string, userId: string, days = 7, note?: string): Promise<unknown> {
    await this.ensureUser(userId);
    const suspendedUntil = new Date(Date.now() + days * 86_400_000);
    await this.prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED', suspendedUntil } });
    await this.prisma.moderationAction.create({
      data: { adminId, targetUserId: userId, action: 'SUSPEND', suspendDays: days, note },
    });
    await this.notifications.push({
      userId,
      type: 'admin',
      title: 'Your account has been suspended',
      body: `Your account is suspended for ${days} days following a review.`,
    });
    return publicUser(await this.ensureUser(userId));
  }

  async ban(adminId: string, userId: string, note?: string): Promise<unknown> {
    const u = await this.ensureUser(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { status: 'BANNED', suspendedUntil: null } });
    await this.prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
    await this.prisma.moderationAction.create({ data: { adminId, targetUserId: userId, action: 'BAN', note } });
    // Record hashed contacts so this person can't simply re-register.
    const emailHash = hashContact(u.email);
    await this.prisma.bannedContact.upsert({ where: { emailHash }, update: { reason: note }, create: { emailHash, reason: note } });
    if (u.phone) {
      const phoneHash = hashContact(u.phone);
      await this.prisma.bannedContact.upsert({ where: { phoneHash }, update: { reason: note }, create: { phoneHash, reason: note } });
    }
    return publicUser(await this.ensureUser(userId));
  }
}
