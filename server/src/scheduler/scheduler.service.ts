import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BusinessService } from '../monetization/business.service';
import { PlanGrantsService } from '../monetization/plan-grants.service';
import { TrustService } from '../trust/trust.service';
import { MailService } from '../mail/mail.service';

const DAY_MS = 86_400_000;
/** Renewal reminders go out about this long before a manual plan ends. */
const REMINDER_LEAD_MS = 5 * DAY_MS;

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger('Scheduler');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly businesses: BusinessService,
    private readonly trust: TrustService,
    private readonly grants: PlanGrantsService,
    private readonly mail: MailService,
  ) {}

  /** Mark ended events COMPLETED and prompt participants to rate (once). */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async completeEndedEvents(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.event.findMany({
      where: { endsAt: { lt: now }, status: 'LIVE' },
      include: { attendances: { select: { userId: true } } },
    });
    for (const e of due) {
      await this.prisma.event.update({ where: { id: e.id }, data: { status: 'COMPLETED' } });
      // Host-success bonus (spec +10 pts → +0.5 on the 0–5 scale).
      await this.trust.adjust(e.hostId, 0.5, 'hosted a completed activity');
      if (!e.ratePromptSentAt) {
        const recipients = [e.hostId, ...e.attendances.map((a) => a.userId)];
        await this.notifications.pushMany(
          recipients.map((userId) => ({
            userId,
            type: 'rate',
            title: 'How was it?',
            body: `Rate the people you met at “${e.title}”.`,
            eventId: e.id,
          })),
        );
        await this.prisma.event.update({ where: { id: e.id }, data: { ratePromptSentAt: now } });
      }
    }
    if (due.length) this.logger.log(`Completed ${due.length} event(s).`);
  }

  /** Auto-cancel LIVE events the host didn't confirm within ~1h of start. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoCancelUnconfirmed(): Promise<void> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + 60 * 60 * 1000);
    const due = await this.prisma.event.findMany({
      where: { status: 'LIVE', hostConfirmedAt: null, startsAt: { gt: now, lte: cutoff } },
      include: { attendances: { select: { userId: true } } },
    });
    for (const e of due) {
      await this.prisma.event.update({ where: { id: e.id }, data: { status: 'CANCELLED' } });
      await this.trust.adjust(e.hostId, -0.5, 'activity auto-cancelled (not confirmed)');
      const recipients = [e.hostId, ...e.attendances.map((a) => a.userId)];
      await this.notifications.pushMany(
        recipients.map((userId) => ({
          userId,
          type: 'admin' as const,
          title: 'Activity auto-cancelled',
          body: `“${e.title}” was cancelled because the host didn’t confirm it in time.`,
          eventId: e.id,
        })),
      );
    }
    if (due.length) this.logger.log(`Auto-cancelled ${due.length} unconfirmed event(s).`);
  }

  /** Day-before reminders for events starting in ~24h (once each). */
  @Cron(CronExpression.EVERY_HOUR)
  async sendReminders(): Promise<void> {
    const now = new Date();
    const from = new Date(now.getTime() + 23 * 3_600_000);
    const to = new Date(now.getTime() + 25 * 3_600_000);
    const upcoming = await this.prisma.event.findMany({
      where: { status: 'LIVE', startsAt: { gte: from, lte: to }, reminderSentAt: null },
      include: { attendances: { select: { userId: true } } },
    });
    for (const e of upcoming) {
      const recipients = [e.hostId, ...e.attendances.map((a) => a.userId)];
      await this.notifications.pushMany(
        recipients.map((userId) => ({
          userId,
          type: 'reminder',
          title: 'Your meetup is tomorrow',
          body: `“${e.title}” is coming up — see who’s going.`,
          eventId: e.id,
        })),
      );
      await this.prisma.event.update({ where: { id: e.id }, data: { reminderSentAt: now } });
    }
    if (upcoming.length) this.logger.log(`Sent reminders for ${upcoming.length} event(s).`);
  }

  /** Lapse suspensions whose window has passed. */
  @Cron(CronExpression.EVERY_HOUR)
  async clearSuspensions(): Promise<void> {
    const res = await this.prisma.user.updateMany({
      where: { status: 'SUSPENDED', suspendedUntil: { lt: new Date() } },
      data: { status: 'ACTIVE', suspendedUntil: null },
    });
    if (res.count) this.logger.log(`Restored ${res.count} suspended account(s).`);
  }

  @Cron('0 0 1 * *')
  async resetBusinessUsage(): Promise<void> {
    await this.businesses.resetMonthlyCounts();
  }

  /**
   * Manual plans end on their date (no auto-renewal): fall back to Free and
   * expire sponsorships whose end date has passed. Logged in the audit trail.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireLapsedPlans(): Promise<void> {
    const now = new Date();
    const lapsedUsers = await this.prisma.user.findMany({
      where: { subscriptionPlan: { not: 'FREE' }, subscriptionEndsAt: { lt: now } },
      select: { id: true },
    });
    for (const u of lapsedUsers) await this.grants.revokePro(u.id, null, 'expire_pro');

    const lapsedSponsorships = await this.prisma.sponsorship.findMany({
      where: { status: 'ACTIVE', endDate: { lt: now } },
      select: { businessId: true },
    });
    for (const businessId of new Set(lapsedSponsorships.map((s) => s.businessId))) {
      await this.grants.revokeSponsorship(businessId, null, 'expire_sponsorship');
    }
    if (lapsedUsers.length || lapsedSponsorships.length) {
      this.logger.log(`Expired ${lapsedUsers.length} Pro plan(s) and ${lapsedSponsorships.length} sponsorship(s).`);
    }
  }

  /**
   * ~5 days before a plan ends, remind the customer (email + in-app) to send a
   * new payment with a new request. Sent once per granted period.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async renewalReminders(): Promise<void> {
    const now = new Date();
    const soon = new Date(now.getTime() + REMINDER_LEAD_MS);

    const users = await this.prisma.user.findMany({
      where: {
        subscriptionPlan: 'PRO',
        subscriptionStatus: 'ACTIVE', // paid plans (referral trials are CANCELED + end date)
        subscriptionEndsAt: { gt: now, lte: soon },
        planReminderSentAt: null,
      },
      select: { id: true, email: true, name: true, locale: true, subscriptionEndsAt: true, status: true },
    });
    for (const u of users) {
      if (u.status === 'BANNED') continue;
      const endsAt = u.subscriptionEndsAt!;
      await this.notifications.push(
        {
          userId: u.id,
          type: 'upgrade',
          title: 'Your Pro Host plan ends soon',
          body: `It’s active until ${endsAt.toISOString().slice(0, 10)} and won’t renew automatically. Send a new payment with a new request to keep it.`,
        },
        { email: false },
      );
      void this.mail.sendPlanEndingSoon(u, 'Pro Host', endsAt, '/pricing').catch(() => undefined);
      await this.prisma.user.update({ where: { id: u.id }, data: { planReminderSentAt: now } });
    }

    const sponsorships = await this.prisma.sponsorship.findMany({
      where: { status: 'ACTIVE', endDate: { gt: now, lte: soon }, reminderSentAt: null },
      include: { business: { select: { name: true, owner: { select: { id: true, email: true, name: true, locale: true } } } } },
    });
    for (const s of sponsorships) {
      const owner = s.business.owner;
      if (owner) {
        const plan = `${s.tier.charAt(0)}${s.tier.slice(1).toLowerCase()} sponsorship`;
        await this.notifications.push(
          {
            userId: owner.id,
            type: 'upgrade',
            title: `Your ${plan} ends soon`,
            body: `“${s.business.name}” is sponsored until ${s.endDate!.toISOString().slice(0, 10)}. Send a new payment with a new request to keep it.`,
          },
          { email: false },
        );
        void this.mail.sendPlanEndingSoon(owner, plan, s.endDate!, '/business/upgrades').catch(() => undefined);
      }
      await this.prisma.sponsorship.update({ where: { id: s.id }, data: { reminderSentAt: now } });
    }
    if (users.length || sponsorships.length) {
      this.logger.log(`Sent ${users.length + sponsorships.length} renewal reminder(s).`);
    }
  }

  /**
   * Pin requests are pointless once the activity has started: cancel them, and
   * drop the hidden extra activity they were holding.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async closeStalePinRequests(): Promise<void> {
    const now = new Date();
    const stale = await this.prisma.upgradeRequest.findMany({
      where: { status: 'PENDING', product: 'PINNED_ACTIVITY', event: { startsAt: { lte: now } } },
      select: { id: true, eventId: true },
    });
    if (!stale.length) return;
    await this.prisma.upgradeRequest.updateMany({
      where: { id: { in: stale.map((r) => r.id) } },
      data: { status: 'CANCELLED', decidedAt: now, adminNote: 'Activity started before payment was confirmed.' },
    });
    await this.prisma.event.updateMany({
      where: { id: { in: stale.map((r) => r.eventId!).filter(Boolean) }, awaitingPayment: true, status: 'LIVE' },
      data: { status: 'CANCELLED' },
    });
    this.logger.log(`Closed ${stale.length} stale pin request(s).`);
  }

  /** Prune chat messages from threads long past expiry. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pruneOldChats(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 86_400_000);
    const stale = await this.prisma.chatThread.findMany({
      where: { expiresAt: { lt: cutoff } },
      select: { id: true },
    });
    if (stale.length) {
      await this.prisma.chatMessage.deleteMany({ where: { threadId: { in: stale.map((t) => t.id) } } });
      this.logger.log(`Pruned messages from ${stale.length} expired thread(s).`);
    }
  }
}
