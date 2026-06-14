import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanType, SubStatus } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { StripeClientService } from './stripe-client.service';

const PLAN_PRICE_ENV = {
  pro: 'stripe.proPriceId',
  premium: 'stripe.premiumPriceId',
} as const;

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly stripeClient: StripeClientService,
  ) {}

  async createCheckoutSession(userId: string, planType: 'pro' | 'premium'): Promise<{ url: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Account not found.');

    const price = this.config.get<string>(PLAN_PRICE_ENV[planType]);
    if (!this.stripeReady(price)) return this.simulateHostPlan(userId, planType);

    const customer = await this.ensureCustomer(userId);
    const session = await this.stripeClient.stripe.checkout.sessions.create({
      customer,
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: `${this.config.get<string>('frontendUrl')}/pricing?success=true`,
      cancel_url: `${this.config.get<string>('frontendUrl')}/pricing?canceled=true`,
      metadata: { userId, kind: 'host_subscription', planType },
      subscription_data: { metadata: { userId, kind: 'host_subscription', planType } },
    });

    if (!session.url) throw new BadRequestException('Stripe did not return a checkout URL.');
    return { url: session.url };
  }

  async createAttendeePremiumCheckout(userId: string): Promise<{ url: string }> {
    const price = this.config.get<string>('stripe.attendeePremiumPriceId');
    if (!this.stripeReady(price)) {
      const premiumUntil = new Date(Date.now() + 30 * 86_400_000);
      await this.prisma.user.update({
        where: { id: userId },
        data: { isPremiumUser: true, premiumUntil, subscriptionStatus: 'ACTIVE' },
      });
      this.logger.warn(`Stripe not configured — simulated attendee premium for user ${userId}.`);
      return { url: `${this.config.get<string>('frontendUrl')}/profile?premium=success&simulated=true` };
    }
    const customer = await this.ensureCustomer(userId);
    const session = await this.stripeClient.stripe.checkout.sessions.create({
      customer,
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: `${this.config.get<string>('frontendUrl')}/profile?premium=success`,
      cancel_url: `${this.config.get<string>('frontendUrl')}/pricing?canceled=true`,
      metadata: { userId, kind: 'attendee_premium', planType: 'attendee' },
      subscription_data: { metadata: { userId, kind: 'attendee_premium', planType: 'attendee' } },
    });
    if (!session.url) throw new BadRequestException('Stripe did not return a checkout URL.');
    return { url: session.url };
  }

  async remainingFreeActivities(
    userId: string,
  ): Promise<{ remaining: number | 'unlimited'; plan: string; status: string; resetsAt?: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Account not found.');
    if (user.subscriptionPlan !== 'FREE' && user.subscriptionStatus === 'ACTIVE') {
      return { remaining: 'unlimited', plan: user.subscriptionPlan.toLowerCase(), status: user.subscriptionStatus.toLowerCase() };
    }
    const since = new Date(Date.now() - 7 * 86_400_000);
    const used = await this.prisma.event.count({ where: { hostId: userId, createdAt: { gte: since } } });
    const remaining = Math.max(0, 1 - used);
    let resetsAt: string | undefined;
    if (remaining === 0) {
      // The free slot reopens once every activity from the last 7 days ages out
      // of the rolling window — i.e. 7 days after the most recent one.
      const latest = await this.prisma.event.findFirst({
        where: { hostId: userId, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (latest) resetsAt = new Date(latest.createdAt.getTime() + 7 * 86_400_000).toISOString();
    }
    return { remaining, plan: 'free', status: user.subscriptionStatus.toLowerCase(), resetsAt };
  }

  /**
   * Whether the user must pay the one-time extra-activity fee to host right now.
   * Free hosts get one activity per rolling week; subscribers host unlimited.
   * Returns false when the user can host for free (within the weekly allowance
   * or on an active paid plan).
   */
  async requiresExtraEventPayment(userId: string): Promise<boolean> {
    const remaining = await this.remainingFreeActivities(userId);
    return remaining.remaining === 0;
  }

  async hostPlanForCreate(userId: string): Promise<{ plan: PlanType; status: SubStatus; pinnedUntil?: Date; premiumPriority: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Account not found.');
    const active = user.subscriptionStatus === 'ACTIVE';
    const pinnedUntil = active && (user.subscriptionPlan === 'PRO' || user.subscriptionPlan === 'PREMIUM')
      ? new Date(Date.now() + 2 * 60 * 60 * 1000)
      : undefined;
    return { plan: user.subscriptionPlan, status: user.subscriptionStatus, pinnedUntil, premiumPriority: active && user.subscriptionPlan === 'PREMIUM' };
  }

  async cancel(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) throw new NotFoundException('No Stripe subscription found.');
    const subs = await this.stripeClient.stripe.subscriptions.list({ customer: user.stripeCustomerId, status: 'active', limit: 10 });
    await Promise.all(subs.data.map((sub) => this.stripeClient.stripe.subscriptions.update(sub.id, { cancel_at_period_end: true })));
    return { message: 'Subscription will cancel at the end of the billing period.' };
  }

  async handleWebhook(event: Stripe.Event): Promise<void> {
    this.logger.log(`Stripe webhook received: ${event.type}`);
    await this.prisma.subscriptionEvent.upsert({
      where: { stripeEventId: event.id },
      update: {},
      create: { stripeEventId: event.id, eventType: event.type, data: event as unknown as object },
    });

    if (event.type === 'checkout.session.completed') {
      await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    }
    if (event.type === 'customer.subscription.deleted') {
      await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
    }
    if (event.type === 'invoice.payment_failed') {
      await this.handleInvoiceStatus(event.data.object as Stripe.Invoice, 'PAST_DUE');
    }
    if (event.type === 'invoice.payment_succeeded') {
      await this.handleInvoiceStatus(event.data.object as Stripe.Invoice, 'ACTIVE');
    }
  }

  /**
   * Real Stripe is only usable with a non-placeholder secret key and a price id.
   * When it isn't configured we simulate checkout so the flow is testable; the
   * moment real keys/price ids are added, real Stripe checkout takes over.
   */
  private stripeReady(price?: string): boolean {
    const secret = this.config.get<string>('stripe.secretKey');
    return !!secret && !secret.includes('xxx') && !!price;
  }

  /** Dev fallback: activate the host plan directly when Stripe isn't configured. */
  private async simulateHostPlan(userId: string, planType: 'pro' | 'premium'): Promise<{ url: string }> {
    const periodEnd = new Date(Date.now() + 30 * 86_400_000);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan: planType === 'premium' ? 'PREMIUM' : 'PRO',
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt: periodEnd,
      },
    });
    this.logger.warn(`Stripe not configured — simulated ${planType} subscription for user ${userId}.`);
    return { url: `${this.config.get<string>('frontendUrl')}/pricing?success=true&simulated=true` };
  }

  private async ensureCustomer(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Account not found.');
    if (user.stripeCustomerId) return user.stripeCustomerId;
    const customer = await this.stripeClient.stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
    return customer.id;
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId || !session.subscription) return;
    const subscription = await this.stripeClient.stripe.subscriptions.retrieve(session.subscription as string);
    const kind = session.metadata?.kind;
    const planType = session.metadata?.planType;
    const periodEnd = new Date(subscription.current_period_end * 1000);

    if (kind === 'attendee_premium') {
      await this.prisma.user.update({ where: { id: userId }, data: { isPremiumUser: true, premiumUntil: periodEnd, subscriptionStatus: 'ACTIVE' } });
      return;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan: planType === 'premium' ? 'PREMIUM' : 'PRO',
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt: periodEnd,
      },
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    await this.prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: { subscriptionPlan: 'FREE', subscriptionStatus: 'CANCELED', isPremiumUser: false },
    });
  }

  private async handleInvoiceStatus(invoice: Stripe.Invoice, status: SubStatus): Promise<void> {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;
    await this.prisma.user.updateMany({ where: { stripeCustomerId: customerId }, data: { subscriptionStatus: status } });
  }
}
