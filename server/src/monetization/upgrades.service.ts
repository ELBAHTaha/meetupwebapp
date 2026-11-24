import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SponsorshipTier, UpgradeProduct, UpgradeRequest, UpgradeRequestStatus } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlanGrantsService } from './plan-grants.service';
import {
  BillingInterval,
  INTERVAL_MONTHS,
  SPONSOR_PRODUCT_TIER,
  fromPrismaInterval,
  requestAmountCents,
  toPrismaInterval,
} from './pricing';

export type ProductInput = 'pro_host' | 'sponsorship_starter' | 'sponsorship_bronze' | 'sponsorship_silver' | 'pinned_activity';

export interface CreateUpgradeInput {
  product: ProductInput;
  interval?: BillingInterval;
  businessId?: string;
  venueId?: string;
  eventId?: string;
  note?: string;
  locale?: string;
}

export interface DecisionInput {
  /** Explicit end date (ISO). Wins over `months`. */
  until?: string;
  /** Months to grant (default: from the requested interval — 1 / 3 / 12). */
  months?: number;
  adminNote?: string;
}

type RequestWithRels = UpgradeRequest & {
  business?: { id: string; name: string } | null;
  event?: { id: string; title: string; startsAt: Date } | null;
  user?: { id: string; name: string; email: string } | null;
};

const REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O/1/I/L lookalikes

const DEFAULT_INSTRUCTIONS: Record<'en' | 'fr' | 'ar', string> = {
  en: 'Send {amount} MAD by bank transfer or CashPlus and write the reference {reference} in the transfer description. Your plan is activated by hand as soon as we receive the payment (usually within 24h).',
  fr: 'Envoie {amount} MAD par virement bancaire ou CashPlus en indiquant la référence {reference} dans le motif du virement. Ton offre est activée manuellement dès réception du paiement (en général sous 24 h).',
  ar: 'صيفط {amount} درهم بالتحويل البنكي ولا CashPlus وكتب المرجع {reference} ف وصف التحويل. العرض ديالك كيتفعّل يدويا غير توصلنا الخلاص (عادة ف أقل من 24 ساعة).',
};

const PRODUCT_LABEL: Record<UpgradeProduct, string> = {
  PRO_HOST: 'Pro Host',
  SPONSORSHIP_STARTER: 'Starter sponsorship',
  SPONSORSHIP_BRONZE: 'Bronze sponsorship',
  SPONSORSHIP_SILVER: 'Silver sponsorship',
  PINNED_ACTIVITY: 'Pinned activity',
};

const madString = (cents: number): string => (cents / 100).toFixed(2).replace(/\.00$/, '');

/**
 * Manual (offline-paid) upgrades. A customer files a request and gets payment
 * instructions + a short reference; an admin confirms the payment and approves,
 * which grants the plan through PlanGrantsService.
 */
@Injectable()
export class UpgradesService {
  private readonly logger = new Logger(UpgradesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly grants: PlanGrantsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---- Payment instructions -----------------------------------------------------

  /** Localized payment instructions (from PAYMENT_INSTRUCTIONS_*), with {amount}/{reference} filled in. */
  instructionsFor(locale: string | null | undefined, amountCents: number, reference: string): string {
    const l = (['en', 'fr', 'ar'] as const).find((x) => x === (locale ?? '').slice(0, 2)) ?? 'en';
    const configured = this.config.get<Record<string, string | undefined>>('payments.instructions') ?? {};
    const template = configured[l] || configured.en || DEFAULT_INSTRUCTIONS[l];
    return template
      .replace(/\\n/g, '\n')
      .replace(/\{amount\}/g, madString(amountCents))
      .replace(/\{reference\}/g, reference);
  }

  private serialize(r: RequestWithRels, locale?: string | null) {
    return {
      id: r.id,
      product: r.product.toLowerCase() as ProductInput,
      status: r.status.toLowerCase() as Lowercase<UpgradeRequestStatus>,
      reference: r.reference,
      amountCents: r.amountCents,
      billingInterval: r.billingInterval ? fromPrismaInterval(r.billingInterval) : undefined,
      businessId: r.businessId ?? undefined,
      businessName: r.business?.name,
      venueId: r.venueId ?? undefined,
      eventId: r.eventId ?? undefined,
      eventTitle: r.event?.title,
      eventStartsAt: r.event?.startsAt.toISOString(),
      note: r.note ?? undefined,
      adminNote: r.adminNote ?? undefined,
      grantedUntil: r.grantedUntil?.toISOString(),
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString(),
      instructions: r.status === 'PENDING' ? this.instructionsFor(locale, r.amountCents, r.reference) : undefined,
      user: r.user ? { id: r.user.id, name: r.user.name, email: r.user.email } : undefined,
    };
  }

  private readonly include = {
    business: { select: { id: true, name: true } },
    event: { select: { id: true, title: true, startsAt: true } },
  } satisfies Prisma.UpgradeRequestInclude;

  private async uniqueReference(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      let code = 'HG-';
      for (let i = 0; i < 5; i++) code += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
      const clash = await this.prisma.upgradeRequest.findUnique({ where: { reference: code }, select: { id: true } });
      if (!clash) return code;
    }
    throw new ConflictException('Could not allocate a payment reference — please try again.');
  }

  // ---- Customer side -------------------------------------------------------------

  async create(userId: string, input: CreateUpgradeInput) {
    const product = input.product.toUpperCase() as UpgradeProduct;
    const interval: BillingInterval = product === 'PINNED_ACTIVITY' ? 'monthly' : input.interval ?? 'monthly';
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true, locale: true, status: true } });
    if (!user) throw new NotFoundException('Account not found.');
    if (user.status !== 'ACTIVE') throw new ForbiddenException('Your account can’t request upgrades right now.');
    const locale = input.locale ?? user.locale;

    let businessId: string | undefined;
    let eventId: string | undefined;
    if (product === 'PRO_HOST') {
      if (user.role === 'BUSINESS') throw new ForbiddenException('Business accounts sponsor venues instead of Pro Host.');
    } else if (SPONSOR_PRODUCT_TIER[product]) {
      if (!input.businessId) throw new BadRequestException('Choose the business to sponsor.');
      await this.assertCanManageBusiness(userId, input.businessId);
      businessId = input.businessId;
    } else if (product === 'PINNED_ACTIVITY') {
      if (!input.eventId) throw new BadRequestException('Choose the activity to pin.');
      const e = await this.prisma.event.findUnique({ where: { id: input.eventId } });
      if (!e || e.hostId !== userId) throw new ForbiddenException('Only the host can pin this activity.');
      if (e.status !== 'LIVE' || e.startsAt <= new Date()) throw new BadRequestException('This activity has already started.');
      if (e.pinnedUntil && e.pinnedUntil >= e.startsAt) throw new BadRequestException('This activity is already pinned.');
      eventId = e.id;
    }

    // One pending request per product/target: return the identical one, refuse a conflicting one.
    const pending = await this.prisma.upgradeRequest.findFirst({
      where: {
        userId,
        status: 'PENDING',
        ...(product === 'PRO_HOST' ? { product } : {}),
        ...(businessId ? { businessId, product: { in: Object.keys(SPONSOR_PRODUCT_TIER) as UpgradeProduct[] } } : {}),
        ...(eventId ? { eventId, product } : {}),
      },
      include: this.include,
    });
    if (pending) {
      const same = pending.product === product && fromPrismaInterval(pending.billingInterval) === interval;
      if (same) return this.serialize(pending, locale);
      throw new ConflictException(
        `You already have a pending request (${pending.reference}). Cancel it first to request a different plan.`,
      );
    }

    const created = await this.prisma.upgradeRequest.create({
      data: {
        userId,
        businessId,
        eventId,
        venueId: input.venueId,
        product,
        billingInterval: product === 'PINNED_ACTIVITY' ? null : toPrismaInterval(interval),
        amountCents: requestAmountCents(product, interval),
        reference: await this.uniqueReference(),
        note: input.note?.slice(0, 1000),
      },
      include: this.include,
    });
    await this.notifications.notifyAdmins({
      type: 'admin',
      title: 'New upgrade request',
      body: `${PRODUCT_LABEL[product]} — ${madString(created.amountCents)} MAD · ref ${created.reference}`,
      eventId,
    });
    return this.serialize(created, locale);
  }

  private async assertCanManageBusiness(userId: string, businessId: string): Promise<void> {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { ownerId: true } });
    if (!biz) throw new NotFoundException('Business not found.');
    if (biz.ownerId === userId) return;
    const member = await this.prisma.businessMember.findFirst({
      where: { businessId, userId, status: 'ACTIVE', role: { in: ['OWNER', 'MANAGER'] } },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('Only the business owner or a manager can request a sponsorship.');
  }

  async mine(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { locale: true } });
    const rows = await this.prisma.upgradeRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: this.include,
    });
    return rows.map((r) => this.serialize(r, user?.locale));
  }

  async cancel(userId: string, id: string) {
    const r = await this.prisma.upgradeRequest.findUnique({ where: { id } });
    if (!r || r.userId !== userId) throw new NotFoundException('Request not found.');
    if (r.status !== 'PENDING') throw new BadRequestException('Only pending requests can be cancelled.');
    await this.prisma.upgradeRequest.update({ where: { id }, data: { status: 'CANCELLED', decidedAt: new Date() } });
    await this.dropUnpaidExtraActivity(r.eventId);
    return { success: true as const };
  }

  /** An extra activity that was only created conditionally on payment is cancelled with its request. */
  private async dropUnpaidExtraActivity(eventId: string | null): Promise<void> {
    if (!eventId) return;
    await this.prisma.event.updateMany({
      where: { id: eventId, awaitingPayment: true, status: 'LIVE' },
      data: { status: 'CANCELLED' },
    });
  }

  // ---- Admin side -----------------------------------------------------------------

  async adminList(status?: string) {
    const where = status ? { status: status.toUpperCase() as UpgradeRequestStatus } : {};
    const rows = await this.prisma.upgradeRequest.findMany({
      where,
      take: 200,
      include: { ...this.include, user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    // Pending first (oldest pending at the top), then the rest newest-first.
    const pending = rows.filter((r) => r.status === 'PENDING').reverse();
    const rest = rows.filter((r) => r.status !== 'PENDING');
    return [...pending, ...rest].map((r) => this.serialize(r));
  }

  private resolveUntil(input: DecisionInput, fallback: () => Promise<Date>): Promise<Date> {
    if (input.until) {
      const d = new Date(input.until);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid end date.');
      return Promise.resolve(d);
    }
    return fallback();
  }

  async approve(adminId: string, id: string, input: DecisionInput) {
    const r = await this.prisma.upgradeRequest.findUnique({ where: { id }, include: this.include });
    if (!r) throw new NotFoundException('Request not found.');
    if (r.status !== 'PENDING') throw new BadRequestException(`This request is already ${r.status.toLowerCase()}.`);
    const interval = fromPrismaInterval(r.billingInterval);
    const months = input.months ?? INTERVAL_MONTHS[interval];
    const ctx = { requestId: r.id, reference: r.reference, amountCents: r.amountCents };

    let until: Date;
    if (r.product === 'PRO_HOST') {
      until = await this.resolveUntil(input, () => this.grants.proUntilFor(r.userId, months));
      await this.grants.grantPro(r.userId, until, adminId, ctx);
    } else if (r.product === 'PINNED_ACTIVITY') {
      if (!r.eventId) throw new BadRequestException('The activity for this request no longer exists.');
      until = await this.grants.pinActivity(r.eventId, adminId, r.reference);
    } else {
      const tier = SPONSOR_PRODUCT_TIER[r.product] as SponsorshipTier;
      if (!r.businessId) throw new BadRequestException('The business for this request no longer exists.');
      until = await this.resolveUntil(input, () => this.grants.sponsorshipUntilFor(r.businessId!, tier, months));
      await this.grants.grantSponsorship(r.businessId, tier, interval, until, adminId, ctx);
    }

    const updated = await this.prisma.upgradeRequest.update({
      where: { id },
      data: { status: 'APPROVED', decidedAt: new Date(), decidedById: adminId, grantedUntil: until, adminNote: input.adminNote },
      include: this.include,
    });
    await this.notifications.push({
      userId: r.userId,
      type: 'upgrade',
      title: `${PRODUCT_LABEL[r.product]} activated ✅`,
      body:
        r.product === 'PINNED_ACTIVITY'
          ? `Payment ${r.reference} received — “${r.event?.title ?? 'your activity'}” is now pinned to the top.`
          : `Payment ${r.reference} received — active until ${until.toISOString().slice(0, 10)}.`,
      eventId: r.eventId ?? undefined,
    });
    this.logger.log(`Upgrade ${r.reference} approved by ${adminId} (until ${until.toISOString()}).`);
    return this.serialize(updated);
  }

  async reject(adminId: string, id: string, adminNote?: string) {
    const r = await this.prisma.upgradeRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Request not found.');
    if (r.status !== 'PENDING') throw new BadRequestException(`This request is already ${r.status.toLowerCase()}.`);
    const updated = await this.prisma.upgradeRequest.update({
      where: { id },
      data: { status: 'REJECTED', decidedAt: new Date(), decidedById: adminId, adminNote },
      include: this.include,
    });
    await this.dropUnpaidExtraActivity(r.eventId);
    await this.notifications.push({
      userId: r.userId,
      type: 'upgrade',
      title: 'Upgrade request declined',
      body: `Request ${r.reference} was declined${adminNote ? `: ${adminNote}` : '.'} Contact us if you already paid.`,
      eventId: r.eventId ?? undefined,
    });
    return this.serialize(updated);
  }

  /** Grant / extend / revoke a user's Pro Host plan directly (no request needed). */
  async adminSetUserPlan(
    adminId: string,
    userId: string,
    input: { action: 'grant' | 'extend' | 'revoke'; until?: string; months?: number; note?: string },
  ) {
    const exists = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!exists) throw new NotFoundException('User not found.');
    if (input.action === 'revoke') {
      await this.grants.revokePro(userId, adminId);
    } else {
      if (exists.role === 'BUSINESS') throw new BadRequestException('Business accounts use venue sponsorships, not Pro Host.');
      const until = await this.resolveUntil(input, () => this.grants.proUntilFor(userId, input.months ?? 1));
      await this.grants.grantPro(userId, until, adminId, { direct: true, note: input.note });
      await this.notifications.push({
        userId,
        type: 'upgrade',
        title: 'Pro Host activated ✅',
        body: `Your Pro Host plan is active until ${until.toISOString().slice(0, 10)}.`,
      });
    }
    return this.adminUserPlan(userId);
  }

  async adminUserPlan(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, subscriptionPlan: true, subscriptionStatus: true, subscriptionEndsAt: true },
    });
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role.toLowerCase(),
      plan: u.subscriptionPlan.toLowerCase(),
      status: u.subscriptionStatus.toLowerCase(),
      endsAt: u.subscriptionEndsAt?.toISOString(),
    };
  }

  /** Search people by name/email for the admin plans screen. */
  async adminSearchUsers(q: string) {
    const term = q.trim();
    if (term.length < 2) return [];
    const users = await this.prisma.user.findMany({
      where: { OR: [{ email: { contains: term } }, { name: { contains: term } }] },
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return Promise.all(users.map((u) => this.adminUserPlan(u.id)));
  }

  /** Grant / extend / revoke a business sponsorship directly. */
  async adminSetSponsorship(
    adminId: string,
    businessId: string,
    input: {
      action: 'grant' | 'extend' | 'revoke';
      tier?: 'starter' | 'bronze' | 'silver';
      interval?: BillingInterval;
      until?: string;
      months?: number;
      note?: string;
    },
  ) {
    if (input.action === 'revoke') {
      await this.grants.revokeSponsorship(businessId, adminId);
      return { success: true as const };
    }
    const current = await this.grants.activeSponsorship(businessId);
    const tier = (input.tier?.toUpperCase() as SponsorshipTier | undefined) ?? current?.tier;
    if (!tier) throw new BadRequestException('Choose a sponsorship tier.');
    const interval = input.interval ?? fromPrismaInterval(current?.billingInterval);
    const until = await this.resolveUntil(input, () =>
      this.grants.sponsorshipUntilFor(businessId, tier, input.months ?? INTERVAL_MONTHS[interval]),
    );
    await this.grants.grantSponsorship(businessId, tier, interval, until, adminId, { direct: true, note: input.note });
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { ownerId: true } });
    if (biz?.ownerId) {
      await this.notifications.push({
        userId: biz.ownerId,
        type: 'upgrade',
        title: 'Sponsorship activated ✅',
        body: `Your ${tier.toLowerCase()} sponsorship is active until ${until.toISOString().slice(0, 10)}.`,
      });
    }
    return { success: true as const, until: until.toISOString() };
  }

  /** Called when an over-quota activity is created with a pin request (see EventsService). */
  createForExtraActivity(userId: string, eventId: string, locale?: string | null) {
    return this.create(userId, { product: 'pinned_activity', eventId, locale: locale ?? undefined });
  }
}
