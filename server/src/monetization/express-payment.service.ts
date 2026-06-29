import { BadRequestException, Injectable } from '@nestjs/common';
import { PriorityLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutSession, ExtraLevel } from '../payments/payment-gateway.interface';

// One-time 19.90 MAD fee to host an extra activity once the free daily activity
// is used up, OR to pin a free activity to the top. `priority` is the single
// live option; `express` is legacy (a plain, cheaper extra) kept only so
// historical payment references still verify.
@Injectable()
export class ExpressPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  /**
   * Start a Paddle checkout for a one-off extra/pinned activity. The frontend
   * completes it in the overlay; the returned `ref` is later passed back at
   * event-creation time as the payment ref.
   */
  async createPaymentIntent(userId: string, priorityLevel: ExtraLevel): Promise<CheckoutSession> {
    return this.payments.createExtraEventCheckout(userId, priorityLevel);
  }

  /**
   * Verify a paid extra-activity order when the activity is created. `paymentRef`
   * is the checkout order id — it must be paid, belong to this user, match the
   * requested priority, and not already have been consumed by another activity.
   */
  async verifyPaymentIntent(paymentRef: string, userId: string, expected?: ExtraLevel): Promise<PriorityLevel> {
    const order = await this.payments.extraEventOrder(paymentRef);
    if (!order) throw new BadRequestException('Extra-activity payment has not succeeded.');
    if (order.userId && order.userId !== userId) throw new BadRequestException('Payment does not belong to this user.');
    if (expected && expected !== order.level) throw new BadRequestException('Payment priority does not match activity priority.');
    const existing = await this.prisma.event.findFirst({ where: { expressPaymentIntentId: paymentRef } });
    if (existing) throw new BadRequestException('This payment has already been used.');
    return order.level === 'priority' ? 'PRIORITY' : 'EXPRESS';
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
