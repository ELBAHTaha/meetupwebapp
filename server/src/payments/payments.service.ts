import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingInterval as PrismaBillingInterval, PlanType, SponsorshipTier } from '@prisma/client';
import type { EventEntity } from '@paddle/paddle-node-sdk';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PaddleService } from './paddle.service';
import {
  BillingInterval,
  BizTier,
  CheckoutOrder,
  CheckoutPurpose,
  CheckoutSession,
  ExtraLevel,
  HostTier,
  billingTotalCents,
  intervalEndDate,
} from './payment-gateway.interface';

// MAD prices in cents (×100). Display + dev-simulation only — when Paddle is
// live the charge is the catalog price configured against each price id.
const HOST_PRICE_CENTS: Record<HostTier, number> = { pro: 4900 };
const SPONSOR_PRICE_CENTS: Record<BizTier, number> = { starter: 19900, bronze: 49000, silver: 99000 };
// One-off extra/pinned activity fee — 19.90 MAD (priority); express is legacy.
const EXTRA_PRICE_CENTS: Record<ExtraLevel, number> = { express: 990, priority: 1990 };
const HOST_TIER_ENUM: Record<HostTier, PlanType> = { pro: 'PRO' };
const BIZ_TIER_ENUM: Record<BizTier, SponsorshipTier> = { starter: 'STARTER', bronze: 'BRONZE', silver: 'SILVER' };

/** Extra facts pulled from a completed Paddle transaction at fulfilment time. */
interface FulfilContext {
  subscriptionId?: string;
  customerId?: string;
  periodEndsAt?: Date;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly paddle: PaddleService,
  ) {}

  configured(): boolean {
    return this.paddle.configured;
  }

  /** Global kill switch — payments stay blocked until PAYMENTS_ENABLED=true. */
  private get enabled(): boolean {
    return this.config.get<boolean>('payments.enabled') ?? false;
  }

  // --- Start a checkout (the frontend opens the Paddle overlay) -------------

  async createHostSubscriptionCheckout(userId: string, tier: HostTier): Promise<CheckoutSession> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (!user) throw new NotFoundException('User not found.');
    const priceId = this.config.get<string>('paddle.prices.hostPro');
    return this.startCheckout({
      priceId,
      amountCents: HOST_PRICE_CENTS[tier],
      email: user.email,
      name: user.name,
      purpose: { kind: 'host_subscription', tier },
      customer: { kind: 'user', id: userId },
    });
  }

  async createSponsorshipCheckout(businessId: string, tier: BizTier, interval: BillingInterval = 'monthly'): Promise<CheckoutSession> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { contactEmail: true, name: true, ownerId: true },
    });
    if (!business) throw new NotFoundException('Business not found.');
    const priceId = this.config.get<string>(`paddle.prices.biz.${tier}.${interval}`);
    return this.startCheckout({
      priceId,
      // Prepaid terms charge the discounted total up front (display only).
      amountCents: billingTotalCents(SPONSOR_PRICE_CENTS[tier], interval),
      email: business.contactEmail,
      name: business.name,
      purpose: { kind: 'business_sponsorship', tier, businessId, interval },
      userId: business.ownerId ?? undefined,
      customer: { kind: 'business', id: businessId },
    });
  }

  async createExtraEventCheckout(userId: string, level: ExtraLevel): Promise<CheckoutSession> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (!user) throw new NotFoundException('User not found.');
    const priceId = this.config.get<string>('paddle.prices.extraPriority');
    return this.startCheckout({
      priceId,
      amountCents: EXTRA_PRICE_CENTS[level],
      email: user.email,
      name: user.name,
      purpose: { kind: 'extra_event', level },
      customer: { kind: 'user', id: userId },
    });
  }

  /**
   * Persist a pending order, then either open a Paddle transaction (live) or
   * apply it immediately (dev simulation when Paddle isn't configured or the
   * price id is missing). The frontend opens `transactionId` in the overlay.
   */
  private async startCheckout(input: {
    priceId?: string;
    amountCents: number;
    email: string;
    name?: string | null;
    purpose: CheckoutPurpose;
    userId?: string;
    customer: { kind: 'user' | 'business'; id: string };
  }): Promise<CheckoutSession> {
    // Hard block while payments are disabled — before the dev-simulation path,
    // so nothing can be granted (paid or free) until Paddle is live.
    if (!this.enabled) {
      throw new ServiceUnavailableException('Payments are temporarily unavailable.');
    }

    const oid = `ord_${Date.now()}${crypto.randomBytes(6).toString('hex')}`;
    const userId = input.userId ?? (input.customer.kind === 'user' ? input.customer.id : undefined);

    // Dev simulation: no real Paddle keys (or no price id) → apply immediately.
    if (!this.paddle.configured || !input.priceId) {
      const order: CheckoutOrder = { oid, userId, email: input.email, amountCents: input.amountCents, purpose: input.purpose };
      await this.persistOrder(order);
      await this.fulfill(oid);
      this.logger.warn(`Paddle not configured — simulated checkout ${oid} (${input.purpose.kind}).`);
      return { ref: oid, amountCents: input.amountCents, simulated: true };
    }

    // Live: ensure a Paddle customer (persisted so cancel can find their subs),
    // then open a transaction carrying our order id in custom_data.
    const customerId = await this.attachCustomer(input.customer, input.email, input.name);
    const transactionId = await this.paddle.createTransaction(input.priceId, customerId, { oid, purpose: input.purpose.kind });
    const order: CheckoutOrder = {
      oid,
      userId,
      email: input.email,
      amountCents: input.amountCents,
      purpose: input.purpose,
      transactionId,
    };
    await this.persistOrder(order);
    return { ref: oid, amountCents: input.amountCents, transactionId };
  }

  /** Find-or-create the Paddle customer and persist its id on the user/business. */
  private async attachCustomer(customer: { kind: 'user' | 'business'; id: string }, email: string, name?: string | null): Promise<string> {
    if (customer.kind === 'user') {
      const user = await this.prisma.user.findUnique({ where: { id: customer.id }, select: { paddleCustomerId: true } });
      if (user?.paddleCustomerId) return user.paddleCustomerId;
      const id = await this.paddle.ensureCustomer(email, name ?? undefined);
      await this.prisma.user.update({ where: { id: customer.id }, data: { paddleCustomerId: id } });
      return id;
    }
    const biz = await this.prisma.business.findUnique({ where: { id: customer.id }, select: { paddleCustomerId: true } });
    if (biz?.paddleCustomerId) return biz.paddleCustomerId;
    const id = await this.paddle.ensureCustomer(email, name ?? undefined);
    await this.prisma.business.update({ where: { id: customer.id }, data: { paddleCustomerId: id } });
    return id;
  }

  private async persistOrder(order: CheckoutOrder): Promise<void> {
    await this.prisma.subscriptionEvent.create({
      data: { userId: order.userId, eventType: 'paddle_order', paddleEventId: order.oid, data: order as unknown as object },
    });
  }

  async loadOrder(oid: string): Promise<{ order: CheckoutOrder; paid: boolean } | null> {
    const rec = await this.prisma.subscriptionEvent.findUnique({ where: { paddleEventId: oid } });
    if (!rec) return null;
    return { order: rec.data as unknown as CheckoutOrder, paid: rec.eventType === 'paddle_paid' };
  }

  // --- Webhooks ------------------------------------------------------------

  /** Verify + dispatch a Paddle webhook. Returns whether an order was applied. */
  async handleWebhook(rawBody: string, signature: string): Promise<boolean> {
    const event = await this.paddle.unmarshalWebhook(rawBody, signature);
    if (!event) return false;
    this.logger.log(`Paddle webhook: ${event.eventType}`);
    switch (event.eventType) {
      case 'transaction.completed':
        return this.onTransactionCompleted(event);
      case 'subscription.canceled':
        await this.onSubscriptionCanceled(event);
        return true;
      case 'transaction.payment_failed':
        await this.onPaymentFailed(event);
        return true;
      default:
        return false;
    }
  }

  private async onTransactionCompleted(event: EventEntity): Promise<boolean> {
    const data = event.data as Record<string, any>;
    const oid = data?.customData?.oid as string | undefined;
    if (!oid) return false;
    const endsAt = data?.billingPeriod?.endsAt ?? data?.currentBillingPeriod?.endsAt;
    return this.fulfill(oid, {
      subscriptionId: data?.subscriptionId ?? undefined,
      customerId: data?.customerId ?? undefined,
      periodEndsAt: endsAt ? new Date(endsAt) : undefined,
    });
  }

  private async onSubscriptionCanceled(event: EventEntity): Promise<void> {
    const customerId = (event.data as Record<string, any>)?.customerId;
    if (!customerId) return;
    await this.prisma.user.updateMany({
      where: { paddleCustomerId: customerId },
      data: { subscriptionPlan: 'FREE', subscriptionStatus: 'CANCELED' },
    });
  }

  private async onPaymentFailed(event: EventEntity): Promise<void> {
    const customerId = (event.data as Record<string, any>)?.customerId;
    if (!customerId) return;
    await this.prisma.user.updateMany({ where: { paddleCustomerId: customerId }, data: { subscriptionStatus: 'PAST_DUE' } });
  }

  // --- Fulfilment ----------------------------------------------------------

  /** Apply an order id idempotently (also used by the dev-simulation path). */
  async fulfill(oid: string, ctx: FulfilContext = {}): Promise<boolean> {
    const found = await this.loadOrder(oid);
    if (!found) throw new NotFoundException('Unknown order.');
    if (found.paid) return true; // already applied
    await this.apply(found.order, ctx);
    await this.prisma.subscriptionEvent.update({ where: { paddleEventId: oid }, data: { eventType: 'paddle_paid' } });
    this.logger.log(`Paddle order ${oid} fulfilled (${found.order.purpose.kind}).`);
    return true;
  }

  /**
   * True when an extra-event order has been paid and not yet consumed. Falls back
   * to a live Paddle lookup when the webhook hasn't landed yet (overlay just closed).
   */
  async extraEventOrder(oid: string): Promise<{ userId?: string; level: ExtraLevel } | null> {
    let found = await this.loadOrder(oid);
    if (!found || found.order.purpose.kind !== 'extra_event') return null;
    if (!found.paid && this.paddle.configured && found.order.transactionId) {
      const txn = await this.paddle.paddle.transactions.get(found.order.transactionId);
      if (txn.status === 'completed') {
        await this.fulfill(oid, { customerId: txn.customerId ?? undefined });
        found = await this.loadOrder(oid);
      }
    }
    if (!found || !found.paid || found.order.purpose.kind !== 'extra_event') return null;
    return { userId: found.order.userId, level: found.order.purpose.level };
  }

  /** Cancel a user's active Paddle host subscription at the end of the period. */
  async cancelHostSubscription(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { paddleCustomerId: true } });
    if (!this.paddle.configured || !user?.paddleCustomerId) return false;
    const count = await this.paddle.cancelActiveSubscriptions(user.paddleCustomerId);
    return count > 0;
  }

  // --- Apply the purchase --------------------------------------------------

  private async apply(order: CheckoutOrder, ctx: FulfilContext): Promise<void> {
    const p = order.purpose;
    if (p.kind === 'host_subscription') {
      if (!order.userId) throw new BadRequestException('Missing user for subscription.');
      await this.prisma.user.update({
        where: { id: order.userId },
        data: {
          subscriptionPlan: HOST_TIER_ENUM[p.tier],
          subscriptionStatus: 'ACTIVE',
          subscriptionEndsAt: ctx.periodEndsAt ?? new Date(Date.now() + 30 * 86_400_000),
        },
      });
    } else if (p.kind === 'business_sponsorship') {
      const start = new Date();
      await this.prisma.business.update({
        where: { id: p.businessId },
        data: { status: 'VERIFIED', verifiedAt: new Date() },
      });
      await this.prisma.sponsorship.create({
        data: {
          businessId: p.businessId,
          tier: BIZ_TIER_ENUM[p.tier],
          monthlyPriceCents: SPONSOR_PRICE_CENTS[p.tier],
          billingInterval: p.interval.toUpperCase() as PrismaBillingInterval,
          startDate: start,
          endDate: ctx.periodEndsAt ?? intervalEndDate(start, p.interval),
          paddleSubscriptionId: ctx.subscriptionId ?? null,
          status: 'ACTIVE',
        },
      });
    }
    // extra_event: no side effect here — the paid order is consumed when the
    // activity is created (see ExpressPaymentService.verifyPaymentIntent).
  }
}
