import { Injectable, NotFoundException } from '@nestjs/common';
import { PlanType, SubStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The plan that governs the user's allowance right now. Plans are granted by
   * an admin until `subscriptionEndsAt` (no auto-renewal); referral trials are
   * stored as CANCELED + a future end date. Past the end date → FREE, even
   * before the hourly expiry job has run.
   */
  private effectivePlan(user: { subscriptionPlan: PlanType; subscriptionStatus: SubStatus; subscriptionEndsAt?: Date | null }): PlanType {
    if (user.subscriptionPlan === 'FREE') return 'FREE';
    const notLapsed = !user.subscriptionEndsAt || user.subscriptionEndsAt > new Date();
    const active = user.subscriptionStatus === 'ACTIVE' && notLapsed;
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
    endsAt?: string;
  }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Account not found.');
    const plan = this.effectivePlan(user);
    const pins = { ...(await this.pinInfo(userId, plan)), endsAt: plan !== 'FREE' ? user.subscriptionEndsAt?.toISOString() : undefined };
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
}
