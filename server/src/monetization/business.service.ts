import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SponsorshipTier } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaddleClientService } from './paddle-client.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterBusinessDto } from './dto/business.dto';

const MAX_VENUE_PHOTOS = 6;

const TIER_PRICE_CENTS: Record<SponsorshipTier, number> = {
  BRONZE: 49000,
  SILVER: 99000,
  GOLD: 199000,
};

const TIER_LIMIT: Record<SponsorshipTier, number | null> = {
  BRONZE: 5,
  SILVER: 15,
  GOLD: null,
};

const TIER_PRICE_CONFIG: Record<'bronze' | 'silver' | 'gold', string> = {
  bronze: 'paddle.bronzePriceId',
  silver: 'paddle.silverPriceId',
  gold: 'paddle.goldPriceId',
};

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly paddleClient: PaddleClientService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  async register(dto: RegisterBusinessDto, ownerId?: string) {
    const business = await this.prisma.business.create({ data: { ...dto, ownerId, status: 'PENDING_VERIFICATION' } });
    await this.notifications.notifyAdmins(
      { type: 'admin', title: 'New business registered', body: `“${business.name}” registered and is awaiting approval.` },
      ownerId,
    );
    return business;
  }

  /** The signed-in owner's venue with its live sponsorship usage and activities. */
  async myBusiness(userId: string): Promise<unknown> {
    const business = await this.prisma.business.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      include: { sponsorships: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!business) throw new NotFoundException('No business found for this account.');
    const sponsorship = business.sponsorships[0] ?? null;
    const limit = sponsorship ? TIER_LIMIT[sponsorship.tier] : null;

    const usages = await this.prisma.activityVenue.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            maxAttendees: true,
            price: true,
            status: true,
            locationLabel: true,
            host: { select: { name: true } },
            activityType: { select: { name: true } },
            attendances: { where: { status: 'JOINED' }, select: { id: true } },
          },
        },
      },
    });

    return {
      business: {
        id: business.id,
        name: business.name,
        description: business.description ?? '',
        address: business.address,
        lat: business.lat ?? undefined,
        lng: business.lng ?? undefined,
        phone: business.phone ?? '',
        contactEmail: business.contactEmail,
        status: business.status.toLowerCase(),
        photos: (business.photos as string[] | null) ?? [],
      },
      sponsorship: sponsorship
        ? {
            tier: sponsorship.tier.toLowerCase(),
            status: sponsorship.status.toLowerCase(),
            used: sponsorship.activitiesUsedThisMonth,
            limit: limit == null ? 'unlimited' : limit,
            remaining: limit == null ? 'unlimited' : Math.max(0, limit - sponsorship.activitiesUsedThisMonth),
            startDate: sponsorship.startDate.toISOString(),
            monthlyPriceCents: sponsorship.monthlyPriceCents,
          }
        : null,
      activities: usages.map((u) => ({
        id: u.activity.id,
        title: u.activity.title,
        activityType: u.activity.activityType.name,
        hostName: u.activity.host.name,
        startsAt: u.activity.startsAt.toISOString(),
        endsAt: u.activity.endsAt.toISOString(),
        going: u.activity.attendances.length,
        capacity: u.activity.maxAttendees,
        price: Number(u.activity.price),
        status: u.activity.status.toLowerCase(),
        locationLabel: u.activity.locationLabel,
        couponCode: u.couponCode ?? undefined,
      })),
    };
  }

  async updateMyBusiness(
    userId: string,
    dto: { name?: string; description?: string; address?: string; phone?: string },
  ): Promise<unknown> {
    const business = await this.prisma.business.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!business) throw new NotFoundException('No business found for this account.');
    await this.prisma.business.update({
      where: { id: business.id },
      data: {
        name: dto.name ?? undefined,
        description: dto.description ?? undefined,
        address: dto.address ?? undefined,
        phone: dto.phone ?? undefined,
      },
    });
    return this.myBusiness(userId);
  }

  /** The signed-in owner's venue (or throw). */
  private async ownedBusiness(userId: string) {
    const business = await this.prisma.business.findFirst({ where: { ownerId: userId }, orderBy: { createdAt: 'desc' } });
    if (!business) throw new NotFoundException('No business found for this account.');
    return business;
  }

  /** Upload one or more venue photos (capped at MAX_VENUE_PHOTOS total). */
  async addPhotos(userId: string, files: { buffer: Buffer; originalname: string; mimetype: string }[]): Promise<unknown> {
    const business = await this.ownedBusiness(userId);
    const current = (business.photos as string[] | null) ?? [];
    const room = Math.max(0, MAX_VENUE_PHOTOS - current.length);
    if (room === 0) throw new BadRequestException(`You can upload up to ${MAX_VENUE_PHOTOS} venue photos.`);
    const accepted = (files ?? []).filter((f) => f.mimetype.startsWith('image/')).slice(0, room);
    const urls = await Promise.all(accepted.map((f) => this.storage.save(f, 'venue')));
    await this.prisma.business.update({ where: { id: business.id }, data: { photos: [...current, ...urls] } });
    return this.myBusiness(userId);
  }

  /** Remove a venue photo by its URL. */
  async removePhoto(userId: string, url: string): Promise<unknown> {
    const business = await this.ownedBusiness(userId);
    const current = (business.photos as string[] | null) ?? [];
    await this.prisma.business.update({ where: { id: business.id }, data: { photos: current.filter((p) => p !== url) } });
    return this.myBusiness(userId);
  }

  async createSponsorshipCheckout(businessId: string, tierInput: 'bronze' | 'silver' | 'gold'): Promise<{ url: string }> {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found.');
    const price = this.config.get<string>(TIER_PRICE_CONFIG[tierInput]);
    if (!this.paddleReady(price)) return this.simulateSponsorship(businessId, tierInput);

    let customerId = business.paddleCustomerId;
    if (!customerId) {
      const customer = await this.paddleClient.paddle.customers.create({
        email: business.contactEmail,
        name: business.name,
      });
      customerId = customer.id;
      await this.prisma.business.update({ where: { id: businessId }, data: { paddleCustomerId: customerId } });
    }

    const txn = await this.paddleClient.paddle.transactions.create({
      items: [{ priceId: price!, quantity: 1 }],
      customerId,
      customData: { businessId, kind: 'business_sponsorship', tier: tierInput },
      checkout: { url: `${this.config.get<string>('frontendUrl')}/business?success=true&business=${businessId}` },
    });
    const url = txn.checkout?.url;
    if (!url) throw new BadRequestException('Paddle did not return a checkout URL.');
    return { url };
  }

  async sponsoredVenues(): Promise<unknown[]> {
    const sponsorships = await this.prisma.sponsorship.findMany({
      where: { status: 'ACTIVE', business: { status: 'VERIFIED' } },
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
        photos: (s.business.photos as string[] | null) ?? [],
      };
    });
  }

  async trackVenueUsage(businessId: string | undefined, activityId: string): Promise<void> {
    if (!businessId) return;
    const sponsorship = await this.prisma.sponsorship.findFirst({
      where: { businessId, status: 'ACTIVE', business: { status: 'VERIFIED' } },
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
      if (event) await this.prisma.user.update({ where: { id: event.hostId }, data: { creditAmountCents: { increment: 5000 } } });
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
    return this.prisma.business.update({ where: { id }, data: { status: 'VERIFIED', verifiedAt: new Date() } });
  }

  async adminBusinesses() {
    return this.prisma.business.findMany({
      include: { sponsorships: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Real Paddle is only usable with a non-placeholder API key and a price id. */
  private paddleReady(price?: string): boolean {
    return this.paddleClient.configured && !!price;
  }

  /**
   * Dev fallback when Paddle isn't configured: approve the business and create
   * an active sponsorship directly so it shows up as a sponsored venue at once.
   */
  private async simulateSponsorship(businessId: string, tierInput: 'bronze' | 'silver' | 'gold'): Promise<{ url: string }> {
    const tier = tierInput.toUpperCase() as SponsorshipTier;
    await this.prisma.business.update({ where: { id: businessId }, data: { status: 'VERIFIED', verifiedAt: new Date() } });
    await this.prisma.sponsorship.create({
      data: {
        businessId,
        tier,
        monthlyPriceCents: TIER_PRICE_CENTS[tier],
        startDate: new Date(),
        status: 'ACTIVE',
      },
    });
    this.logger.warn(`Paddle not configured — simulated ${tierInput} sponsorship for business ${businessId}.`);
    return { url: `${this.config.get<string>('frontendUrl')}/business?success=true&simulated=true&business=${businessId}` };
  }

  private couponCode(): string {
    return `HUDLGO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }
}
