import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PriorityLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StripeClientService } from './stripe-client.service';

// One-time fee to host an extra activity in the same week once the single free
// weekly activity is used up. `express` = a plain extra activity; `priority` =
// an extra activity that also gets featured (pinned) placement.
const PRIORITY_AMOUNT: Record<'express' | 'priority', number> = {
  express: 99,
  priority: 299,
};

@Injectable()
export class ExpressPaymentService {
  private readonly logger = new Logger(ExpressPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly stripeClient: StripeClientService,
  ) {}

  async createPaymentIntent(userId: string, priorityLevel: 'express' | 'priority'): Promise<{ clientSecret: string; amountCents: number }> {
    const amount = PRIORITY_AMOUNT[priorityLevel];
    const intent = await this.stripeClient.stripe.paymentIntents.create({
      amount,
      currency: this.config.get<string>('stripe.currency', 'usd'),
      automatic_payment_methods: { enabled: true },
      metadata: { userId, priorityLevel, kind: 'extra_event' },
    });
    if (!intent.client_secret) throw new BadRequestException('Stripe did not return a client secret.');
    return { clientSecret: intent.client_secret, amountCents: amount };
  }

  async verifyPaymentIntent(paymentIntentId: string, userId: string, expected?: 'express' | 'priority'): Promise<PriorityLevel> {
    const intent = await this.stripeClient.stripe.paymentIntents.retrieve(paymentIntentId);
    const priority = intent.metadata.priorityLevel as 'express' | 'priority' | undefined;
    if (intent.status !== 'succeeded') throw new BadRequestException('Extra-event payment has not succeeded.');
    if (intent.metadata.userId !== userId) throw new BadRequestException('Payment does not belong to this user.');
    if (!priority || !PRIORITY_AMOUNT[priority]) throw new BadRequestException('Payment is missing priority metadata.');
    if (expected && expected !== priority) throw new BadRequestException('Payment priority does not match activity priority.');
    if (intent.amount_received < PRIORITY_AMOUNT[priority]) throw new BadRequestException('Payment amount is incomplete.');
    const existing = await this.prisma.event.findFirst({ where: { expressPaymentIntentId: paymentIntentId } });
    if (existing) throw new BadRequestException('This payment has already been used.');
    return priority === 'priority' ? 'PRIORITY' : 'EXPRESS';
  }

  async pendingPaidActivities(): Promise<unknown[]> {
    const events = await this.prisma.event.findMany({
      where: { priorityLevel: { in: ['EXPRESS', 'PRIORITY'] }, expressFeePaid: true },
      include: { host: true, activityType: true },
      orderBy: [{ priorityLevel: 'desc' }, { createdAt: 'asc' }],
    });
    return events.map((event) => ({
      id: event.id,
      title: event.title,
      hostName: event.host.name,
      priorityLevel: event.priorityLevel.toLowerCase(),
      paymentIntentId: event.expressPaymentIntentId,
      createdAt: event.createdAt.toISOString(),
    }));
  }
}
