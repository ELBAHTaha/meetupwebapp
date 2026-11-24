import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { avatarFor } from '../common/serializers/user.serializer';
import { attendeeSuffix, parseCouponCode, withinRedeemWindow } from '../common/utils/coupon';

export type CouponProblem = 'INVALID_CODE' | 'NOT_FOUND' | 'NEED_ATTENDEE_CODE' | 'OUT_OF_WINDOW' | 'ALREADY_REDEEMED';

export interface CouponCheck {
  ok: boolean;
  problem?: CouponProblem;
  code?: string;
  offer?: string;
  activity?: { id: string; title: string; startsAt: string };
  attendee?: { id: string; name: string; avatar: string };
  redeemedAt?: string;
}

const MESSAGES: Record<CouponProblem, string> = {
  INVALID_CODE: 'That doesn’t look like a hudlgo coupon code.',
  NOT_FOUND: 'No coupon with that code at your venue.',
  NEED_ATTENDEE_CODE: 'Ask for the full code shown in the attendee’s app (it ends with 4 extra characters).',
  OUT_OF_WINDOW: 'This coupon can only be used on the day of the activity (± 1 day).',
  ALREADY_REDEEMED: 'This coupon was already redeemed.',
};

/**
 * Staff-side coupon checks for Silver-sponsored activities. A valid coupon is
 * the activity's code + the attendee's suffix, belongs to this business, is
 * used on the activity's day ± 1 (Morocco time), and only once per attendee.
 */
@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  private async findUsage(businessId: string, activityCode: string) {
    return this.prisma.activityVenue.findFirst({
      where: { couponCode: activityCode, businessId },
      include: {
        business: { select: { couponOffer: true } },
        activity: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            attendances: {
              where: { status: 'JOINED' },
              select: { user: { select: { id: true, name: true, photoUrl: true } } },
            },
          },
        },
      },
    });
  }

  async lookup(businessId: string, input: string): Promise<CouponCheck & { activityVenueId?: string }> {
    const parsed = parseCouponCode(input ?? '');
    if (!parsed) return { ok: false, problem: 'INVALID_CODE' };

    const usage = await this.findUsage(businessId, parsed.activityCode);
    // Another business's code reads as "not found" — never confirm it exists.
    if (!usage) return { ok: false, problem: 'NOT_FOUND' };

    const base = {
      activityVenueId: usage.id,
      offer: usage.business.couponOffer ?? undefined,
      activity: { id: usage.activity.id, title: usage.activity.title, startsAt: usage.activity.startsAt.toISOString() },
    };
    if (!parsed.suffix) return { ok: false, problem: 'NEED_ATTENDEE_CODE', ...base };

    const matches = usage.activity.attendances.filter((a) => attendeeSuffix(usage.id, a.user.id) === parsed.suffix);
    if (matches.length !== 1) return { ok: false, problem: 'NOT_FOUND', ...base };
    const u = matches[0].user;
    const code = `${parsed.activityCode}-${parsed.suffix}`;
    const attendee = { id: u.id, name: u.name, avatar: avatarFor(u) };

    const prior = await this.prisma.couponRedemption.findUnique({
      where: { activityId_userId: { activityId: usage.activity.id, userId: u.id } },
    });
    if (prior) {
      return { ok: false, problem: 'ALREADY_REDEEMED', code, attendee, redeemedAt: prior.createdAt.toISOString(), ...base };
    }
    if (!withinRedeemWindow(usage.activity.startsAt)) return { ok: false, problem: 'OUT_OF_WINDOW', code, attendee, ...base };
    return { ok: true, code, attendee, ...base };
  }

  async redeem(businessId: string, input: string, staffId: string): Promise<CouponCheck> {
    const { activityVenueId, ...check } = await this.lookup(businessId, input);
    if (!check.ok) {
      const body = { message: MESSAGES[check.problem!], code: `COUPON_${check.problem}` };
      throw check.problem === 'ALREADY_REDEEMED' ? new ConflictException(body) : new BadRequestException(body);
    }
    try {
      const r = await this.prisma.couponRedemption.create({
        data: {
          activityVenueId: activityVenueId!,
          activityId: check.activity!.id,
          userId: check.attendee!.id,
          businessId,
          redeemedById: staffId,
          code: check.code!,
        },
      });
      return { ...check, redeemedAt: r.createdAt.toISOString() };
    } catch (err) {
      // Two staff tapping "redeem" at once — the unique (activity, attendee) pair wins.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ message: MESSAGES.ALREADY_REDEEMED, code: 'COUPON_ALREADY_REDEEMED' });
      }
      throw err;
    }
  }
}
