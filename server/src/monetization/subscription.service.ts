import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PlanType, SubStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutSession, HostTier } from '../payments/payment-gateway.interface';

// How often each plan may host 1 activity (null = unlimited). Free = 1/day,
// Pro = unlimited. Legacy tiers retained so historical subscriptions still work.
const HOSTING_WINDOW_MS: Record<PlanType, number | null> = {
  FREE: 1 * 86_400_000,
  PRO: null,
  BRONZE: 2 * 86_400_000,
  SILVER: 1 * 86_400_000,
  GOLD: null,
};

// Auto-pins granted per rolling 7 days by plan (Infinity = always pin).
const PIN_QUOTA: Record<PlanType, number> = { FREE: 0, PRO: 7, BRONZE: 1, SILVER: 3, GOLD: Infinity };
const PIN_WINDOW_MS = 7 * 86_400_000;

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  /**
   * Start a Pro Host checkout: opens a Paddle transaction and returns the
   * checkout session. The frontend completes it in the Paddle.js overlay; the
   * subscription is activated when Paddle's `transaction.completed` webhook lands.
   */
  async createCheckoutSession(userId: string, planType: HostTier): Promise<CheckoutSession> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Account not found.');
    return this.payments.createHostSubscriptionCheckout(userId, planType);
  }

  /** The plan that governs the user's allowance right now. A canceled plan keeps
   * its tier until the end of the paid term; otherwise FREE. */
  private effectivePlan(user: { subscriptionPlan: PlanType; subscriptionStatus: SubStatus; subscriptionEndsAt?: Date | null }): PlanType {
    if (user.subscriptionPlan === 'FREE') return 'FREE';
    const active = user.subscriptionStatus === 'ACTIVE';
    const inPaidTerm = user.subscriptionStatus === 'CANCELED' && !!user.subscriptionEndsAt && user.subscriptionEndsAt > new Date();
    return active || inPaidTerm ? user.subscriptionPlan : 'FREE';
  }

  /** Weekly auto-pin allowance for a plan, plus how many remain this window. */
  private async pinInfo(userId: string, plan: PlanType): Promise<{ pinsRemaining: number | 'unlimited'; pinQuota: number | 'unlimited' }> {
    const quota = PIN_QUOTA[plan];
    if (quota === Infinity) return { pinsRemaining: 'unlimited', pinQuota: 'unlimited' };
    if (quota <= 0) return { pinsRemaining: 0, pinQuota: 0 };
    const since = new Date(Date.now() - PIN_WINDOW_MS);
    const usedPins = await this.prisma.event.count({
      where: { hostId: userId, createdAt: { gte: since }, pinnedUntil: { not: null } },
    });
    return { pinsRemaining: Math.max(0, quota - usedPins), pinQuota: quota };
  }

  async remainingFreeActivities(userId: string): Promise<{
    remaining: number | 'unlimited';
    plan: string;
    status: string;
    resetsAt?: string;
    pinsRemaining: number | 'unlimited';
    pinQuota: number | 'unlimited';
  }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Account not found.');
    const plan = this.effectivePlan(user);
    const pins = await this.pinInfo(userId, plan);
    const windowMs = HOSTING_WINDOW_MS[plan];
    if (windowMs === null) {
      return { remaining: 'unlimited', plan: plan.toLowerCase(), status: user.subscriptionStatus.toLowerCase(), ...pins };
    }
    const since = new Date(Date.now() - windowMs);
    const used = await this.prisma.event.count({ where: { hostId: userId, createdAt: { gte: since } } });
    const remaining = Math.max(0, 1 - used);
    let resetsAt: string | undefined;
    if (remaining === 0) {
      // The slot reopens once the most recent activity ages out of the window.
      const latest = await this.prisma.event.findFirst({
        where: { hostId: userId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (latest) resetsAt = new Date(latest.createdAt.getTime() + windowMs).toISOString();
    }
    return { remaining, plan: plan.toLowerCase(), status: user.subscriptionStatus.toLowerCase(), resetsAt, ...pins };
  }

  /**
   * Whether the user must pay the one-time extra-activity fee to host right now.
   * Returns false when the user can host within their allowance.
   */
  async requiresExtraEventPayment(userId: string): Promise<boolean> {
    const remaining = await this.remainingFreeActivities(userId);
    return remaining.remaining === 0;
  }

  /** Whether a host has a weekly auto-pin left under their tier quota. */
  private async hasPinAllowance(userId: string, plan: PlanType): Promise<boolean> {
    const quota = PIN_QUOTA[plan];
    if (quota <= 0) return false;
    if (quota === Infinity) return true;
    const since = new Date(Date.now() - PIN_WINDOW_MS);
    const usedPins = await this.prisma.event.count({
      where: { hostId: userId, createdAt: { gte: since }, pinnedUntil: { not: null } },
    });
    return usedPins < quota;
  }

  async hostPlanForCreate(userId: string): Promise<{ plan: PlanType; status: SubStatus; autoPin: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Account not found.');
    const plan = this.effectivePlan(user);
    const autoPin = await this.hasPinAllowance(userId, plan);
    return { plan: user.subscriptionPlan, status: user.subscriptionStatus, autoPin };
  }

  /**
   * Cancel the Pro Host plan. The Paddle subscription is scheduled to stop at the
   * end of the current billing period; we mark the plan CANCELED locally so the
   * user keeps Pro access until `subscriptionEndsAt`, then falls back to Free.
   * (`subscription.canceled` webhook later confirms the downgrade.)
   */
  async cancel(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.subscriptionPlan === 'FREE') throw new NotFoundException('No active subscription found.');
    await this.payments.cancelHostSubscription(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: 'CANCELED' } });
    this.logger.log(`User ${userId} canceled their ${user.subscriptionPlan} plan.`);
    return { message: 'Subscription will cancel at the end of the billing period. You keep Pro access until then.' };
  }
}
