import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SponsorshipTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StripeClientService } from './stripe-client.service';
import { RegisterBusinessDto } from './dto/business.dto';

const TIER_PRICE_CENTS: Record<SponsorshipTier, number> = {
  BRONZE: 4900,
  SILVER: 9900,
  GOLD: 19900,
};

const TIER_LIMIT: Record<SponsorshipTier, number | null> = {
  BRONZE: 5,
  SILVER: 15,
  GOLD: null,
};

const TIER_PRICE_CONFIG: Record<'bronze' | 'silver' | 'gold', string> = {
  bronze: 'stripe.bronzePriceId',
  silver: 'stripe.silverPriceId',
  gold: 'stripe.goldPriceId',
};

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly stripeClient: StripeClientService,
  ) {}

  register(dto: RegisterBusinessDto) {
    return this.prisma.business.create({ data: { ...dto, status: 'PENDING' } });
  }

  async createSponsorshipCheckout(businessId: string, tierInput: 'bronze' | 'silver' | 'gold'): Promise<{ url: string }> {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found.');
    const price = this.config.get<string>(TIER_PRICE_CONFIG[tierInput]);
    if (!this.stripeReady(price)) return this.simulateSponsorship(businessId, tierInput);

    let customerId = business.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripeClient.stripe.customers.create({
        email: business.contactEmail,
        name: business.name,
        metadata: { businessId },
      });
      customerId = customer.id;
      await this.prisma.business.update({ where: { id: businessId }, data: { stripeCustomerId: customerId } });
    }

    const session = await this.stripeClient.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: `${this.config.get<string>('frontendUrl')}/business?success=true&business=${businessId}`,
      cancel_url: `${this.config.get<string>('frontendUrl')}/business?canceled=true`,
      metadata: { businessId, kind: 'business_sponsorship', tier: tierInput },
      subscription_data: { metadata: { businessId, kind: 'business_sponsorship', tier: tierInput } },
    });
    if (!session.url) throw new BadRequestException('Stripe did not return a checkout URL.');
    return { url: session.url };
  }

  async sponsoredVenues(): Promise<unknown[]> {
    const sponsorships = await this.prisma.sponsorship.findMany({
      where: { status: 'ACTIVE', business: { status: 'APPROVED' } },
      include: { business: true },
      orderBy: [{ tier: 'desc' }, { createdAt: 'desc' }],
    });
    return sponsorships.map((s) => {
      const limit = TIER_LIMIT[s.tier];
      return {
        id: s.business.id,
        name: s.business.name,
        address: s.business.address,
        lat: s.business.lat,
        lng: s.business.lng,
        tier: s.tier.toLowerCase(),
        used: s.activitiesUsedThisMonth,
        limit,
        remaining: limit == null ? 'unlimited' : Math.max(0, limit - s.activitiesUsedThisMonth),
      };
    });
  }

  async trackVenueUsage(businessId: string | undefined, activityId: string): Promise<void> {
    if (!businessId) return;
    const sponsorship = await this.prisma.sponsorship.findFirst({
      where: { businessId, status: 'ACTIVE', business: { status: 'APPROVED' } },
      orderBy: { createdAt: 'desc' },
    });
    if (!sponsorship) return;

    const limit = TIER_LIMIT[sponsorship.tier];
    if (limit != null && sponsorship.activitiesUsedThisMonth >= limit) {
      throw new BadRequestException('This sponsored venue has reached its monthly activity limit.');
    }

    const nextUsage = sponsorship.activitiesUsedThisMonth + 1;
    if (limit != null && nextUsage >= Math.ceil(limit * 0.8)) {
      this.logger.warn(`Business ${businessId} sponsorship usage is ${nextUsage}/${limit}.`);
    }

    await this.prisma.$transaction([
      this.prisma.sponsorship.update({
        where: { id: sponsorship.id },
        data: { activitiesUsedThisMonth: { increment: 1 } },
      }),
      this.prisma.activityVenue.create({
        data: {
          activityId,
          businessId,
          sponsorshipId: sponsorship.id,
          isSponsored: true,
          couponCode: sponsorship.tier === 'SILVER' ? this.couponCode() : null,
        },
      }),
    ]);

    if (sponsorship.tier === 'GOLD') {
      const event = await this.prisma.event.findUnique({ where: { id: activityId } });
      if (event) await this.prisma.user.update({ where: { id: event.hostId }, data: { creditAmountCents: { increment: 500 } } });
    }
  }

  async resetMonthlyCounts(): Promise<void> {
    const result = await this.prisma.sponsorship.updateMany({
      where: { status: 'ACTIVE' },
      data: { activitiesUsedThisMonth: 0, lastResetDate: new Date() },
    });
    this.logger.log(`Reset monthly sponsorship usage for ${result.count} sponsorships.`);
  }

  async approveBusiness(id: string) {
    return this.prisma.business.update({ where: { id }, data: { status: 'APPROVED' } });
  }

  async adminBusinesses() {
    return this.prisma.business.findMany({
      include: { sponsorships: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Real Stripe is only usable with a non-placeholder secret key and a price id. */
  private stripeReady(price?: string): boolean {
    const secret = this.config.get<string>('stripe.secretKey');
    return !!secret && !secret.includes('xxx') && !!price;
  }

  /**
   * Dev fallback when Stripe isn't configured: approve the business and create
   * an active sponsorship directly so it shows up as a sponsored venue at once.
   */
  private async simulateSponsorship(businessId: string, tierInput: 'bronze' | 'silver' | 'gold'): Promise<{ url: string }> {
    const tier = tierInput.toUpperCase() as SponsorshipTier;
    await this.prisma.business.update({ where: { id: businessId }, data: { status: 'APPROVED' } });
    await this.prisma.sponsorship.create({
      data: {
        businessId,
        tier,
        monthlyPriceCents: TIER_PRICE_CENTS[tier],
        startDate: new Date(),
        status: 'ACTIVE',
      },
    });
    this.logger.warn(`Stripe not configured — simulated ${tierInput} sponsorship for business ${businessId}.`);
    return { url: `${this.config.get<string>('frontendUrl')}/business?success=true&simulated=true&business=${businessId}` };
  }

  private couponCode(): string {
    return `JMAA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }
}
