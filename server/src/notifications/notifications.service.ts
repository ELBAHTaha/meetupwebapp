import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RealtimeService } from '../realtime/realtime.service';

export interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  eventId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly realtime: RealtimeService,
  ) {}

  /** `opts.email=false` skips the email mirror (when a dedicated email is sent instead). */
  async push(input: NotifyInput, opts: { email?: boolean } = {}): Promise<void> {
    await this.prisma.notification.create({ data: input });
    void this.emitLive([input]).catch((e) => this.logger.error(`live push failed: ${e?.message}`));
    // Mirror to email (fire-and-forget — email must never block or break the flow).
    if (opts.email !== false) {
      void this.emailMany([input]).catch((e) => this.logger.error(`email mirror failed: ${e?.message}`));
    }
  }

  async pushMany(inputs: NotifyInput[]): Promise<void> {
    if (inputs.length === 0) return;
    await this.prisma.notification.createMany({ data: inputs });
    void this.emitLive(inputs).catch((e) => this.logger.error(`live push failed: ${e?.message}`));
    void this.emailMany(inputs).catch((e) => this.logger.error(`email mirror failed: ${e?.message}`));
  }

  /**
   * Push a lightweight `notification:new` to each recipient's open sockets, with
   * their fresh unread count so the bell badge updates without a refetch.
   */
  private async emitLive(inputs: NotifyInput[]): Promise<void> {
    const ids = [...new Set(inputs.map((i) => i.userId))];
    const counts = await this.prisma.notification.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, read: false },
      _count: { _all: true },
    });
    const unread = new Map(counts.map((c) => [c.userId, c._count._all]));
    for (const input of inputs) {
      this.realtime.toUsers([input.userId], 'notification:new', {
        type: input.type,
        title: input.title,
        body: input.body,
        eventId: input.eventId ?? null,
        unread: unread.get(input.userId) ?? 0,
      });
    }
  }

  /**
   * Send the email mirror for a batch of notifications. Looks up each recipient's
   * email + preference once, and only emails users who haven't opted out.
   */
  private async emailMany(inputs: NotifyInput[]): Promise<void> {
    const ids = [...new Set(inputs.map((i) => i.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true, name: true, role: true, emailNotifications: true, status: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    await Promise.all(
      inputs.map((input) => {
        const u = byId.get(input.userId);
        if (!u || !u.emailNotifications || u.status === 'BANNED') return undefined;
        return this.mail.sendNotification({ email: u.email, name: u.name, role: u.role }, input);
      }),
    );
  }

  /** Notify every admin (optionally excluding the actor who triggered it). */
  async notifyAdmins(input: Omit<NotifyInput, 'userId'>, exceptUserId?: string): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
      select: { id: true },
    });
    await this.pushMany(admins.map((a) => ({ ...input, userId: a.id })));
  }

  async list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(userId: string, id: string): Promise<{ success: true }> {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
    await this.emitUnread(userId);
    return { success: true };
  }

  async markAllRead(userId: string): Promise<{ success: true }> {
    await this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
    this.realtime.toUsers([userId], 'notification:unread', { unread: 0 });
    return { success: true };
  }

  /** Sync the unread badge across the user's other tabs/devices. */
  private async emitUnread(userId: string): Promise<void> {
    const unread = await this.prisma.notification.count({ where: { userId, read: false } });
    this.realtime.toUsers([userId], 'notification:unread', { unread });
  }
}
