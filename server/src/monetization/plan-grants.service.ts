import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, SponsorshipTier } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BillingInterval, SPONSOR_MONTHLY_CENTS, addMonths, toPrismaInterval } from './pricing';

export type AuditKind =
  | 'grant_pro'
  | 'extend_pro'
  | 'revoke_pro'
  | 'expire_pro'
  | 'grant_sponsorship'
  | 'extend_sponsorship'
  | 'revoke_sponsorship'
  | 'expire_sponsorship'
  | 'pin_activity';

/**
 * The single place that changes paid plans. Used by admin approvals of upgrade
 * requests, direct admin grants/extensions/revocations, and the expiry job —
 * so every change follows the same rules and lands in the audit log
 * (SubscriptionEvent) with the acting admin's id.
 */
@Injectable()
export class PlanGrantsService {
  private readonly logger = new Logger(PlanGrantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async audit(kind: AuditKind, data: Record<string, unknown>, userId?: string | null, adminId?: string | null): Promise<void> {
    await this.prisma.subscriptionEvent.create({
      data: {
        userId: userId ?? null,
        adminId: adminId ?? null,
        eventType: kind,
        // Legacy unique column (was the Paddle event id) — a generated audit id now.
        paddleEventId: `audit_${Date.now()}_${randomBytes(6).toString('hex')}`,
        data: data as Prisma.InputJsonValue,
      },
    });
  }

  // ---- Pro Host --------------------------------------------------------------

  /** Current Pro end date if the user is on Pro (incl. referral trials), else null. */
  private async activeProEnd(userId: string): Promise<Date | null> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionPlan: true, subscriptionEndsAt: true },
    });
    if (!u) throw new NotFoundException('User not found.');
    if (u.subscriptionPlan === 'FREE' || !u.subscriptionEndsAt) return null;
    return u.subscriptionEndsAt > new Date() ? u.subscriptionEndsAt : null;
  }

  /** Default end date for `months` of Pro, stacked on top of any remaining Pro time. */
  async proUntilFor(userId: string, months: number): Promise<Date> {
    const base = (await this.activeProEnd(userId)) ?? new Date();
    return addMonths(base, months);
  }

  async grantPro(userId: string, until: Date, adminId: string, extra: Record<string, unknown> = {}): Promise<Date> {
    if (until <= new Date()) throw new BadRequestException('The end date must be in the future.');
    const extending = !!(await this.activeProEnd(userId));
    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE', subscriptionEndsAt: until, planReminderSentAt: null },
    });
    await this.audit(extending ? 'extend_pro' : 'grant_pro', { until: until.toISOString(), ...extra }, userId, adminId);
    return until;
  }

  async revokePro(userId: string, adminId: string | null, kind: 'revoke_pro' | 'expire_pro' = 'revoke_pro'): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionPlan: 'FREE', subscriptionStatus: 'INACTIVE', subscriptionEndsAt: null, planReminderSentAt: null },
    });
    await this.audit(kind, {}, userId, adminId);
  }

  // ---- Business sponsorships ---------------------------------------------------

  private async ownerOf(businessId: string): Promise<string | null> {
    const b = await this.prisma.business.findUnique({ where: { id: businessId }, select: { ownerId: true } });
    if (!b) throw new NotFoundException('Business not found.');
    return b.ownerId;
  }

  async activeSponsorship(businessId: string) {
    return this.prisma.sponsorship.findFirst({
      where: { businessId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Default end for `months` of a tier: stacks on the current one if it's the same tier. */
  async sponsorshipUntilFor(businessId: string, tier: SponsorshipTier, months: number): Promise<Date> {
    const current = await this.activeSponsorship(businessId);
    const base = current && current.tier === tier && current.endDate && current.endDate > new Date() ? current.endDate : new Date();
    return addMonths(base, months);
  }

  /**
   * Activate (or extend) a sponsorship until `until`. Same tier → the current
   * sponsorship is extended (usage carries over). Different tier → the old one
   * ends now and a new one starts. Approving also verifies the business, as the
   * paid flow always did.
   */
  async grantSponsorship(
    businessId: string,
    tier: SponsorshipTier,
    interval: BillingInterval,
    until: Date,
    adminId: string,
    extra: Record<string, unknown> = {},
  ): Promise<Date> {
    if (until <= new Date()) throw new BadRequestException('The end date must be in the future.');
    const ownerId = await this.ownerOf(businessId);
    const current = await this.activeSponsorship(businessId);
    if (current && current.tier === tier) {
      await this.prisma.sponsorship.update({
        where: { id: current.id },
        data: { endDate: until, billingInterval: toPrismaInterval(interval), reminderSentAt: null },
      });
      await this.audit('extend_sponsorship', { businessId, tier, interval, until: until.toISOString(), ...extra }, ownerId, adminId);
    } else {
      if (current) {
        await this.prisma.sponsorship.update({ where: { id: current.id }, data: { status: 'CANCELED', endDate: new Date() } });
      }
      await this.prisma.sponsorship.create({
        data: {
          businessId,
          tier,
          monthlyPriceCents: SPONSOR_MONTHLY_CENTS[tier],
          billingInterval: toPrismaInterval(interval),
          startDate: new Date(),
          endDate: until,
          status: 'ACTIVE',
        },
      });
      await this.audit('grant_sponsorship', { businessId, tier, interval, until: until.toISOString(), ...extra }, ownerId, adminId);
    }
    await this.prisma.business.updateMany({
      where: { id: businessId, status: { not: 'VERIFIED' } },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    });
    return until;
  }

  async revokeSponsorship(
    businessId: string,
    adminId: string | null,
    kind: 'revoke_sponsorship' | 'expire_sponsorship' = 'revoke_sponsorship',
  ): Promise<void> {
    const ownerId = await this.ownerOf(businessId);
    const res = await this.prisma.sponsorship.updateMany({
      where: { businessId, status: 'ACTIVE' },
      data: kind === 'expire_sponsorship' ? { status: 'EXPIRED' } : { status: 'CANCELED', endDate: new Date() },
    });
    if (res.count) await this.audit(kind, { businessId }, ownerId, adminId);
  }

  // ---- Pinned / extra activity -------------------------------------------------

  /**
   * Pin an activity until it starts. For an extra activity created beyond the
   * free quota (awaitingPayment), this also publishes it.
   */
  async pinActivity(eventId: string, adminId: string, reference: string): Promise<Date> {
    const e = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!e) throw new NotFoundException('Activity not found.');
    if (e.status !== 'LIVE' || e.startsAt <= new Date()) {
      throw new BadRequestException('This activity has already started or is no longer live.');
    }
    await this.prisma.event.update({
      where: { id: eventId },
      data: {
        pinnedUntil: e.startsAt,
        priorityLevel: 'PRIORITY',
        expressFeePaid: true,
        expressPaymentIntentId: reference,
        ...(e.awaitingPayment ? { awaitingPayment: false, approvedAt: e.approvedAt ?? new Date() } : {}),
      },
    });
    await this.audit('pin_activity', { eventId, reference, until: e.startsAt.toISOString() }, e.hostId, adminId);
    this.logger.log(`Activity ${eventId} pinned until ${e.startsAt.toISOString()} (${reference}).`);
    return e.startsAt;
  }
}
