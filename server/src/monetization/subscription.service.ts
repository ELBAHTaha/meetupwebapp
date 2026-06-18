import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanType, SubStatus } from '@prisma/client';
import type { EventEntity } from '@paddle/paddle-node-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { PaddleClientService } from './paddle-client.service';

export type HostTier = 'bronze' | 'silver' | 'gold';

const PLAN_PRICE_ENV: Record<HostTier, string> = {
  bronze: 'paddle.hostBronzePriceId',
  silver: 'paddle.hostSilverPriceId',
  gold: 'paddle.hostGoldPriceId',
};

const TIER_ENUM: Record<HostTier, PlanType> = { bronze: 'BRONZE', silver: 'SILVER', gold: 'GOLD' };

// How often each plan may host 1 activity (null = unlimited). Free = 1/3 days,
// Bronze = 1/2 days, Silver = 1/day, Gold = unlimited.
const HOSTING_WINDOW_MS: Record<PlanType, number | null> = {
  FREE: 3 * 86_400_000,
  BRONZE: 2 * 86_400_000,
  SILVER: 1 * 86_400_000,
  GOLD: null,
};

// Auto-pins granted per rolling 7 days by plan (Infinity = always pin).
const PIN_QUOTA: Record<PlanType, number> = { FREE: 0, BRONZE: 1, SILVER: 3, GOLD: Infinity };
const PIN_WINDOW_MS = 7 * 86_400_000;

/** Shape of the bits of a Paddle transaction/subscription webhook we read. */
interface PaddleWebhookData {
  customerId?: string | null;
  subscriptionId?: string | null;
  customData?: Record<string, unknown> | null;
  billingPeriod?: { endsAt: string } | null;
  currentBillingPeriod?: { endsAt: string } | null;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly paddleClient: PaddleClientService,
  ) {}

  async createCheckoutSession(userId: string, planType: HostTier): Promise<{ url: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Account not found.');

    const price = this.config.get<string>(PLAN_PRICE_ENV[planType]);
    if (!this.paddleReady(price)) return this.simulateHostPlan(userId, planType);

    const customerId = await this.ensureCustomer(userId);
    const txn = await this.paddleClient.paddle.transactions.create({
      items: [{ priceId: price!, quantity: 1 }],
      customerId,
      customData: { userId, kind: 'host_subscription', planType },
      checkout: { url: `${this.config.get<string>('frontendUrl')}/pricing?success=true` },
    });

    const url = txn.checkout?.url;
    if (!url) throw new BadRequestException('Paddle did not return a checkout URL.');
    return { url };
  }

  async createAttendeePremiumCheckout(userId: string): Promise<{ url: string }> {
    const price = this.config.get<string>('paddle.attendeePremiumPriceId');
    if (!this.paddleReady(price)) {
      const premiumUntil = new Date(Date.now() + 30 * 86_400_000);
      await this.prisma.user.update({
        where: { id: userId },
        data: { isPremiumUser: true, premiumUntil, subscriptionStatus: 'ACTIVE' },
      });
      this.logger.warn(`Paddle not configured — simulated attendee premium for user ${userId}.`);
      return { url: `${this.config.get<string>('frontendUrl')}/profile?premium=success&simulated=true` };
    }
    const customerId = await this.ensureCustomer(userId);
    const txn = await this.paddleClient.paddle.transactions.create({
      items: [{ priceId: price!, quantity: 1 }],
      customerId,
      customData: { userId, kind: 'attendee_premium', planType: 'attendee' },
      checkout: { url: `${this.config.get<string>('frontendUrl')}/profile?premium=success` },
    });
    const url = txn.checkout?.url;
    if (!url) throw new BadRequestException('Paddle did not return a checkout URL.');
    return { url };
  }

  /** The plan that governs the user's allowance right now (FREE unless an active paid tier). */
  private effectivePlan(user: { subscriptionPlan: PlanType; subscriptionStatus: SubStatus }): PlanType {
    return user.subscriptionStatus === 'ACTIVE' && user.subscriptionPlan !== 'FREE' ? user.subscriptionPlan : 'FREE';
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
   * Each plan hosts 1 activity per its window (Free 3d / Bronze 2d / Silver 1d /
   * Gold unlimited). Returns false when the user can host within their allowance.
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

  async cancel(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.paddleCustomerId) throw new NotFoundException('No Paddle subscription found.');
    const collection = this.paddleClient.paddle.subscriptions.list({
      customerId: [user.paddleCustomerId],
      status: ['active'],
    });
    const subs = await collection.next();
    await Promise.all(
      subs.map((sub) => this.paddleClient.paddle.subscriptions.cancel(sub.id, { effectiveFrom: 'next_billing_period' })),
    );
    return { message: 'Subscription will cancel at the end of the billing period.' };
  }

  async handleWebhook(event: EventEntity): Promise<void> {
    this.logger.log(`Paddle webhook received: ${event.eventType}`);
    await this.prisma.subscriptionEvent.upsert({
      where: { paddleEventId: event.eventId },
      update: {},
      create: { paddleEventId: event.eventId, eventType: event.eventType, data: event as unknown as object },
    });

    const data = event.data as unknown as PaddleWebhookData;
    switch (event.eventType) {
      case 'transaction.completed':
        await this.handleTransactionCompleted(data);
        break;
      case 'subscription.canceled':
        await this.handleSubscriptionCanceled(data);
        break;
      case 'transaction.payment_failed':
        await this.handleCustomerStatus(data.customerId, 'PAST_DUE');
        break;
      default:
        break;
    }
  }

  /**
   * Real Paddle is only usable with a non-placeholder API key and a price id.
   * When it isn't configured we simulate checkout so the flow is testable; the
   * moment a real key/price id is added, real Paddle checkout takes over.
   */
  private paddleReady(price?: string): boolean {
    return this.paddleClient.configured && !!price;
  }

  /** Dev fallback: activate the host plan directly when Paddle isn't configured. */
  private async simulateHostPlan(userId: string, planType: HostTier): Promise<{ url: string }> {
    const periodEnd = new Date(Date.now() + 30 * 86_400_000);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan: TIER_ENUM[planType],
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt: periodEnd,
      },
    });
    this.logger.warn(`Paddle not configured — simulated ${planType} subscription for user ${userId}.`);
    return { url: `${this.config.get<string>('frontendUrl')}/pricing?success=true&simulated=true` };
  }

  private async ensureCustomer(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Account not found.');
    if (user.paddleCustomerId) return user.paddleCustomerId;
    const customer = await this.paddleClient.paddle.customers.create({ email: user.email, name: user.name });
    await this.prisma.user.update({ where: { id: userId }, data: { paddleCustomerId: customer.id } });
    return customer.id;
  }

  private async handleTransactionCompleted(data: PaddleWebhookData): Promise<void> {
    const custom = data.customData ?? {};
    const userId = typeof custom.userId === 'string' ? custom.userId : undefined;
    if (!userId) return;
    const kind = custom.kind;
    const planType = custom.planType;
    const endsAt = data.billingPeriod?.endsAt ?? data.currentBillingPeriod?.endsAt;
    const periodEnd = endsAt ? new Date(endsAt) : new Date(Date.now() + 30 * 86_400_000);

    if (kind === 'attendee_premium') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { isPremiumUser: true, premiumUntil: periodEnd, subscriptionStatus: 'ACTIVE' },
      });
      return;
    }

    if (kind === 'host_subscription') {
      const tier = TIER_ENUM[(planType as HostTier)] ?? 'BRONZE';
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionPlan: tier,
          subscriptionStatus: 'ACTIVE',
          subscriptionEndsAt: periodEnd,
        },
      });
    }
  }

  private async handleSubscriptionCanceled(data: PaddleWebhookData): Promise<void> {
    if (!data.customerId) return;
    await this.prisma.user.updateMany({
      where: { paddleCustomerId: data.customerId },
      data: { subscriptionPlan: 'FREE', subscriptionStatus: 'CANCELED', isPremiumUser: false },
    });
  }

  private async handleCustomerStatus(customerId: string | null | undefined, status: SubStatus): Promise<void> {
    if (!customerId) return;
    await this.prisma.user.updateMany({ where: { paddleCustomerId: customerId }, data: { subscriptionStatus: status } });
  }
}
