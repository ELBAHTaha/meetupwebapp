import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BusinessService } from '../monetization/business.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger('Scheduler');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly businesses: BusinessService,
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

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async renewalReminders(): Promise<void> {
    const soon = new Date(Date.now() + 3 * 86_400_000);
    const users = await this.prisma.user.findMany({
      where: { subscriptionStatus: 'ACTIVE', subscriptionEndsAt: { lte: soon, gte: new Date() } },
      select: { id: true, subscriptionPlan: true, subscriptionEndsAt: true },
    });
    await this.notifications.pushMany(
      users.map((user) => ({
        userId: user.id,
        type: 'admin',
        title: 'Subscription renewal soon',
        body: `Your ${user.subscriptionPlan.toLowerCase()} plan renews soon.`,
      })),
    );
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
