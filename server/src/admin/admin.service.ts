import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { publicUser, userPublicInclude } from '../common/serializers/user.serializer';
import { eventInclude, serializeEvent } from '../common/serializers/event.serializer';
import { BusinessService } from '../monetization/business.service';
import { ExpressPaymentService } from '../monetization/express-payment.service';
import { hashContact } from '../auth/auth.service';
import { nearestCityName } from '../common/utils/area';

const HOST_PRICE_CENTS = { BRONZE: 2990, SILVER: 5990, GOLD: 9990 } as const;
const TIER_PRICE_CENTS = { BRONZE: 49000, SILVER: 99000, GOLD: 199000 } as const;

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

  /** Full analytics dashboard: totals, growth, engagement, moderation, revenue. */
  async analytics(): Promise<unknown> {
    const now = new Date();
    const day = 86_400_000;
    const since7 = new Date(now.getTime() - 7 * day);
    const since30 = new Date(now.getTime() - 30 * day);
    const since14Start = new Date(now.getTime() - 13 * day);
    since14Start.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      suspended,
      banned,
      totalActivities,
      liveActivities,
      completedActivities,
      cancelledActivities,
      pendingApproval,
      underReview,
      totalBusinesses,
      approvedBusinesses,
      openReports,
      resolvedReports,
      newUsers7d,
      newUsers30d,
      newActivities7d,
      joins7d,
      messages7d,
      totalAttendances,
      paidExtras,
      bronzeCount,
      silverCount,
      goldCount,
      trustAgg,
      hostGroups,
      typeGroups,
      tierGroups,
      flagged,
      eventLocations,
      recentUsers,
      recentEvents,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.user.count({ where: { status: 'BANNED' } }),
      this.prisma.event.count(),
      this.prisma.event.count({ where: { status: 'LIVE' } }),
      this.prisma.event.count({ where: { status: 'COMPLETED' } }),
      this.prisma.event.count({ where: { status: 'CANCELLED' } }),
      this.prisma.event.count({ where: { status: 'LIVE', approvedAt: null } }),
      this.prisma.event.count({ where: { underReview: true } }),
      this.prisma.business.count(),
      this.prisma.business.count({ where: { status: 'VERIFIED' } }),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.prisma.report.count({ where: { status: 'RESOLVED' } }),
      this.prisma.user.count({ where: { createdAt: { gte: since7 } } }),
      this.prisma.user.count({ where: { createdAt: { gte: since30 } } }),
      this.prisma.event.count({ where: { createdAt: { gte: since7 } } }),
      this.prisma.attendance.count({ where: { joinedAt: { gte: since7 } } }),
      this.prisma.chatMessage.count({ where: { sentAt: { gte: since7 } } }),
      this.prisma.attendance.count(),
      this.prisma.event.count({ where: { expressFeePaid: true } }),
      this.prisma.user.count({ where: { subscriptionPlan: 'BRONZE', subscriptionStatus: 'ACTIVE' } }),
      this.prisma.user.count({ where: { subscriptionPlan: 'SILVER', subscriptionStatus: 'ACTIVE' } }),
      this.prisma.user.count({ where: { subscriptionPlan: 'GOLD', subscriptionStatus: 'ACTIVE' } }),
      this.prisma.user.aggregate({ _avg: { trustScore: true } }),
      this.prisma.event.groupBy({ by: ['hostId'], _count: { _all: true } }),
      this.prisma.event.groupBy({ by: ['activityTypeId'], _count: { _all: true } }),
      this.prisma.sponsorship.groupBy({ by: ['tier'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
      this.flaggedUsers(),
      this.prisma.event.findMany({ select: { lat: true, lng: true, areaLabel: true } }),
      this.prisma.user.findMany({ where: { createdAt: { gte: since14Start } }, select: { createdAt: true } }),
      this.prisma.event.findMany({ where: { createdAt: { gte: since14Start } }, select: { createdAt: true } }),
    ]);

    // Activity-type names for the "top categories" breakdown.
    const types = await this.prisma.activityType.findMany({ select: { id: true, name: true } });
    const typeName = new Map(types.map((t) => [t.id, t.name]));
    const topActivities = typeGroups
      .map((g) => ({ label: typeName.get(g.activityTypeId) ?? 'Other', count: g._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Top cities by general area (host-entered label, else nearest known city).
    const cityCounts = new Map<string, number>();
    for (const e of eventLocations) {
      const name = e.areaLabel || nearestCityName({ lat: e.lat, lng: e.lng }, 60) || 'Other';
      cityCounts.set(name, (cityCounts.get(name) ?? 0) + 1);
    }
    const topCities = [...cityCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const bucketByDay = (items: { createdAt: Date }[]) => {
      const map = new Map<string, number>();
      for (let i = 0; i < 14; i++) {
        const d = new Date(since14Start.getTime() + i * day);
        map.set(d.toISOString().slice(0, 10), 0);
      }
      for (const it of items) {
        const k = it.createdAt.toISOString().slice(0, 10);
        if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
      }
      return [...map.entries()].map(([date, count]) => ({ date, count }));
    };

    const tierCount = (tier: 'BRONZE' | 'SILVER' | 'GOLD') =>
      tierGroups.find((g) => g.tier === tier)?._count._all ?? 0;
    const bronze = tierCount('BRONZE');
    const silver = tierCount('SILVER');
    const gold = tierCount('GOLD');

    const mrrCents =
      bronzeCount * HOST_PRICE_CENTS.BRONZE +
      silverCount * HOST_PRICE_CENTS.SILVER +
      goldCount * HOST_PRICE_CENTS.GOLD +
      bronze * TIER_PRICE_CENTS.BRONZE +
      silver * TIER_PRICE_CENTS.SILVER +
      gold * TIER_PRICE_CENTS.GOLD;

    return {
      totals: {
        users: totalUsers,
        activities: totalActivities,
        liveActivities,
        businesses: totalBusinesses,
        approvedBusinesses,
        subscribers: bronzeCount + silverCount + goldCount,
        attendances: totalAttendances,
      },
      growth: {
        newUsers7d,
        newUsers30d,
        newActivities7d,
        joins7d,
        messages7d,
      },
      engagement: {
        avgTrust: Number(trustAgg._avg.trustScore ?? 0),
        avgAttendeesPerActivity: totalActivities ? totalAttendances / totalActivities : 0,
        activeHosts: hostGroups.length,
      },
      moderation: {
        openReports,
        resolvedReports,
        flaggedUsers: flagged.length,
        underReview,
        pendingApproval,
        suspended,
        banned,
      },
      monetization: {
        hostBronze: bronzeCount,
        hostSilver: silverCount,
        hostGold: goldCount,
        paidExtras,
        mrrCents,
        businessTiers: { bronze, silver, gold },
      },
      activityStatus: { live: liveActivities, completed: completedActivities, cancelled: cancelledActivities },
      topActivities,
      topCities,
      signupsByDay: bucketByDay(recentUsers),
      activitiesByDay: bucketByDay(recentEvents),
    };
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

  /** Users awaiting identity (selfie) verification review. */
  async pendingVerifications(): Promise<unknown[]> {
    const users = await this.prisma.user.findMany({
      where: { verificationStatus: 'PENDING' },
      include: userPublicInclude,
      orderBy: { updatedAt: 'asc' },
    });
    return users.map((u) => ({
      user: publicUser(u),
      selfieUrl: u.verificationSelfieUrl,
      pose: u.verificationPose ?? undefined,
      submittedAt: u.updatedAt.toISOString(),
    }));
  }

  async approveVerification(userId: string): Promise<{ success: true }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { verified: true, verificationStatus: 'APPROVED', verifiedAt: new Date() },
    });
    await this.notifications.push({
      userId,
      type: 'admin',
      title: 'You’re verified ✓',
      body: 'Your identity is confirmed — a verified badge now shows on your profile.',
    });
    return { success: true };
  }

  async rejectVerification(userId: string): Promise<{ success: true }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { verified: false, verificationStatus: 'REJECTED' },
    });
    await this.notifications.push({
      userId,
      type: 'admin',
      title: 'Verification not approved',
      body: 'We couldn’t verify your selfie. Please try again with a clear photo matching the pose.',
    });
    return { success: true };
  }

  businessesList(): Promise<unknown[]> {
    return this.businesses.adminBusinesses();
  }

  approveBusiness(id: string): Promise<unknown> {
    return this.businesses.approveBusiness(id);
  }

  // --- business verification queue ---------------------------------------

  /** Pending business RC/ICE verification submissions awaiting review. */
  async businessVerifications(): Promise<unknown[]> {
    const items = await this.prisma.businessVerification.findMany({
      where: { status: 'PENDING' },
      include: { business: { select: { id: true, name: true, category: true, contactEmail: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return items.map((v) => ({
      id: v.id,
      businessId: v.businessId,
      businessName: v.business.name,
      category: v.business.category,
      contactEmail: v.business.contactEmail,
      rcNumber: v.rcNumber ?? undefined,
      iceNumber: v.iceNumber ?? undefined,
      documentUrls: (v.documentUrls as string[] | null) ?? [],
      submittedAt: v.createdAt.toISOString(),
    }));
  }

  async approveBusinessVerification(id: string, adminId: string): Promise<{ success: true }> {
    const v = await this.prisma.businessVerification.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Verification not found.');
    await this.prisma.$transaction([
      this.prisma.businessVerification.update({ where: { id }, data: { status: 'APPROVED', reviewedById: adminId } }),
      this.prisma.business.update({ where: { id: v.businessId }, data: { status: 'VERIFIED', verifiedAt: new Date() } }),
    ]);
    const business = await this.prisma.business.findUnique({ where: { id: v.businessId } });
    if (business?.ownerId) {
      await this.notifications.push({
        userId: business.ownerId,
        type: 'admin',
        title: 'Your business is verified ✓',
        body: `“${business.name}” is now verified — a verified badge shows on your business and venues.`,
      });
    }
    return { success: true };
  }

  async rejectBusinessVerification(id: string, adminId: string, note?: string): Promise<{ success: true }> {
    const v = await this.prisma.businessVerification.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Verification not found.');
    await this.prisma.$transaction([
      this.prisma.businessVerification.update({ where: { id }, data: { status: 'REJECTED', reviewedById: adminId, note } }),
      this.prisma.business.update({ where: { id: v.businessId }, data: { status: 'REJECTED' } }),
    ]);
    const business = await this.prisma.business.findUnique({ where: { id: v.businessId } });
    if (business?.ownerId) {
      await this.notifications.push({
        userId: business.ownerId,
        type: 'admin',
        title: 'Business verification not approved',
        body: note || 'We couldn’t verify your business. Please resubmit clear RC/ICE documents.',
      });
    }
    return { success: true };
  }

  // --- venue claim queue --------------------------------------------------

  async venueClaims(): Promise<unknown[]> {
    const claims = await this.prisma.venueClaim.findMany({
      where: { status: 'PENDING' },
      include: {
        venue: { select: { id: true, name: true, address: true } },
        business: { select: { id: true, name: true, contactEmail: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return claims.map((c) => ({
      id: c.id,
      venueId: c.venueId,
      venueName: c.venue.name,
      venueAddress: c.venue.address,
      businessId: c.businessId,
      businessName: c.business.name,
      evidence: (c.evidence as string[] | null) ?? [],
      submittedAt: c.createdAt.toISOString(),
    }));
  }

  async approveVenueClaim(id: string, adminId: string): Promise<{ success: true }> {
    const claim = await this.prisma.venueClaim.findUnique({ where: { id }, include: { business: true } });
    if (!claim) throw new NotFoundException('Claim not found.');
    await this.prisma.$transaction([
      this.prisma.venueClaim.update({ where: { id }, data: { status: 'APPROVED', reviewedById: adminId } }),
      this.prisma.venue.update({
        where: { id: claim.venueId },
        data: { businessId: claim.businessId, status: claim.business.status === 'VERIFIED' ? 'VERIFIED' : 'CLAIMED' },
      }),
    ]);
    if (claim.business.ownerId) {
      const venue = await this.prisma.venue.findUnique({ where: { id: claim.venueId } });
      await this.notifications.push({
        userId: claim.business.ownerId,
        type: 'admin',
        title: 'Venue claim approved ✓',
        body: `“${venue?.name}” is now linked to your business.`,
      });
    }
    return { success: true };
  }

  async rejectVenueClaim(id: string, adminId: string, note?: string): Promise<{ success: true }> {
    const claim = await this.prisma.venueClaim.findUnique({ where: { id }, include: { business: true } });
    if (!claim) throw new NotFoundException('Claim not found.');
    await this.prisma.venueClaim.update({ where: { id }, data: { status: 'REJECTED', reviewedById: adminId, note } });
    if (claim.business.ownerId) {
      await this.notifications.push({
        userId: claim.business.ownerId,
        type: 'admin',
        title: 'Venue claim not approved',
        body: note || 'We couldn’t verify your claim to this venue.',
      });
    }
    return { success: true };
  }

  // --- venue review moderation -------------------------------------------

  async flagVenueReview(id: string): Promise<{ success: true }> {
    await this.prisma.venueReview.update({ where: { id }, data: { status: 'FLAGGED' } });
    return { success: true };
  }

  async removeVenueReview(id: string): Promise<{ success: true }> {
    const review = await this.prisma.venueReview.update({ where: { id }, data: { status: 'REMOVED' } });
    await this.recomputeVenueRating(review.venueId);
    return { success: true };
  }

  private async recomputeVenueRating(venueId: string): Promise<void> {
    const agg = await this.prisma.venueReview.aggregate({
      where: { venueId, status: 'VISIBLE' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await this.prisma.venue.update({
      where: { id: venueId },
      data: { avgRating: agg._avg.rating ?? 0, reviewCount: agg._count._all },
    });
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
      title: 'A note from the hudlgo team',
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
