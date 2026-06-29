import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const REWARD_DAYS = 7;
const DAY_MS = 86_400_000;
// Unambiguous alphabet (no 0/O/1/I/L) for human-friendly codes.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 6;

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The user's referral code, generating + persisting one on first request. */
  async codeFor(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (user?.referralCode) return user.referralCode;
    const code = await this.uniqueCode();
    await this.prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
    return code;
  }

  /** Invite link + how many friends joined + the per-referral reward. */
  async summary(userId: string): Promise<{ code: string; link: string; joinedCount: number; rewardDays: number }> {
    const code = await this.codeFor(userId);
    const frontendUrl = (this.config.get<string>('frontendUrl') ?? '').replace(/\/$/, '');
    const joinedCount = await this.prisma.user.count({ where: { referredById: userId } });
    return { code, link: `${frontendUrl}/signup?ref=${code}`, joinedCount, rewardDays: REWARD_DAYS };
  }

  /**
   * Credit a referral when a brand-new user signs up with an invite code.
   * Best-effort: never throws, so a referral hiccup can't break signup. Grants
   * both the inviter and the newcomer {@link REWARD_DAYS} of Pro Host.
   */
  async applyOnSignup(newUserId: string, code?: string): Promise<void> {
    if (!code) return;
    try {
      const inviter = await this.prisma.user.findUnique({
        where: { referralCode: code.trim().toUpperCase() },
        select: { id: true, name: true },
      });
      if (!inviter || inviter.id === newUserId) return;

      const newUser = await this.prisma.user.findUnique({
        where: { id: newUserId },
        select: { name: true, referredById: true },
      });
      if (!newUser || newUser.referredById) return; // already attributed

      await this.prisma.user.update({ where: { id: newUserId }, data: { referredById: inviter.id } });
      await this.grantProTrial(newUserId, REWARD_DAYS);
      await this.grantProTrial(inviter.id, REWARD_DAYS);

      await this.notifications.push({
        userId: inviter.id,
        type: 'referral',
        title: 'Your invite paid off 🎉',
        body: `${newUser.name} joined from your invite — you both earned ${REWARD_DAYS} days of Pro Host.`,
      });
      await this.notifications.push({
        userId: newUserId,
        type: 'referral',
        title: `Welcome — ${REWARD_DAYS} days of Pro on us 🎁`,
        body: `You joined via ${inviter.name}'s invite, so you've got ${REWARD_DAYS} days of Pro Host free.`,
      });
      this.logger.log(`Referral: ${inviter.id} invited ${newUserId} (+${REWARD_DAYS}d Pro each).`);
    } catch (e) {
      this.logger.warn(`referral apply failed: ${(e as Error)?.message}`);
    }
  }

  /**
   * Grant a time-boxed Pro Host trial that auto-expires to Free. Reuses the
   * existing "canceled-but-in-paid-term" grace (see SubscriptionService.
   * effectivePlan): CANCELED + a future subscriptionEndsAt = Pro until that date.
   * A genuinely paying (ACTIVE) Pro user just gets the end date pushed out.
   */
  private async grantProTrial(userId: string, days: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionPlan: true, subscriptionStatus: true, subscriptionEndsAt: true },
    });
    if (!user) return;
    const now = Date.now();
    const base = user.subscriptionEndsAt && user.subscriptionEndsAt.getTime() > now ? user.subscriptionEndsAt.getTime() : now;
    const subscriptionEndsAt = new Date(base + days * DAY_MS);

    if (user.subscriptionPlan === 'PRO' && user.subscriptionStatus === 'ACTIVE') {
      await this.prisma.user.update({ where: { id: userId }, data: { subscriptionEndsAt } });
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { subscriptionPlan: 'PRO', subscriptionStatus: 'CANCELED', subscriptionEndsAt },
      });
    }
  }

  private async uniqueCode(): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const code = Array.from({ length: CODE_LEN }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
      const taken = await this.prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
      if (!taken) return code;
    }
    return Date.now().toString(36).toUpperCase().slice(-CODE_LEN); // fallback, vanishingly rare
  }
}
