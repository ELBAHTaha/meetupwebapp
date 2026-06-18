import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PriorityLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaddleClientService } from './paddle-client.service';

// One-time fee to host an extra activity in the same week once the single free
// weekly activity is used up. `express` = a plain extra activity; `priority` =
// an extra activity that also gets featured (pinned) placement.
const PRIORITY_AMOUNT: Record<'express' | 'priority', number> = {
  express: 990,
  priority: 2990,
};

const PRICE_CONFIG: Record<'express' | 'priority', string> = {
  express: 'paddle.expressPriceId',
  priority: 'paddle.priorityPriceId',
};

@Injectable()
export class ExpressPaymentService {
  private readonly logger = new Logger(ExpressPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly paddleClient: PaddleClientService,
  ) {}

  /**
   * Starts a one-time Paddle transaction for an extra activity. When Paddle
   * isn't configured we return a `mock_` reference so the dev simulation flow
   * works end-to-end (the frontend opens the overlay only for real txn ids).
   */
  async createPaymentIntent(
    userId: string,
    priorityLevel: 'express' | 'priority',
  ): Promise<{ clientSecret: string; amountCents: number; transactionId?: string }> {
    const amount = PRIORITY_AMOUNT[priorityLevel];
    const price = this.config.get<string>(PRICE_CONFIG[priorityLevel]);
    if (!this.paddleClient.configured || !price) {
      this.logger.warn(`Paddle not configured — simulated extra-activity payment (${priorityLevel}) for user ${userId}.`);
      return { clientSecret: `mock_${priorityLevel}_payment_intent`, amountCents: amount };
    }
    const txn = await this.paddleClient.paddle.transactions.create({
      items: [{ priceId: price, quantity: 1 }],
      customData: { userId, priorityLevel, kind: 'extra_event' },
    });
    return { clientSecret: '', amountCents: amount, transactionId: txn.id };
  }

  async verifyPaymentIntent(paymentRef: string, userId: string, expected?: 'express' | 'priority'): Promise<PriorityLevel> {
    // Dev simulation: a `mock_` reference is accepted as paid.
    if (paymentRef.startsWith('mock_')) {
      const priority = paymentRef.includes('priority') ? 'priority' : 'express';
      if (expected && expected !== priority) throw new BadRequestException('Payment priority does not match activity priority.');
      return priority === 'priority' ? 'PRIORITY' : 'EXPRESS';
    }

    const txn = await this.paddleClient.paddle.transactions.get(paymentRef);
    const custom = (txn.customData ?? {}) as Record<string, unknown>;
    const priority = custom.priorityLevel as 'express' | 'priority' | undefined;
    if (txn.status !== 'completed' && txn.status !== 'paid') throw new BadRequestException('Extra-event payment has not succeeded.');
    if (custom.userId !== userId) throw new BadRequestException('Payment does not belong to this user.');
    if (!priority || !PRIORITY_AMOUNT[priority]) throw new BadRequestException('Payment is missing priority metadata.');
    if (expected && expected !== priority) throw new BadRequestException('Payment priority does not match activity priority.');
    const existing = await this.prisma.event.findFirst({ where: { expressPaymentIntentId: paymentRef } });
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
