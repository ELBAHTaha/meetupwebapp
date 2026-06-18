import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Venue } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BusinessAccessService } from './business-access.service';
import { haversineKm } from '../common/utils/haversine';
import {
  ClaimVenueDto,
  CreateVenueDto,
  CreateVenueReviewDto,
  UpdateVenueDto,
  VenueQueryDto,
} from './dto/venue.dto';

type UploadFile = { buffer: Buffer; originalname: string; mimetype: string };

@Injectable()
export class VenueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly access: BusinessAccessService,
  ) {}

  /** Browse / search venues (category, free text, near-me). */
  async list(query: VenueQueryDto) {
    const venues = await this.prisma.venue.findMany({
      where: {
        ...(query.category ? { category: query.category } : {}),
        ...(query.q ? { name: { contains: query.q } } : {}),
      },
      orderBy: [{ reviewCount: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });

    let result = venues;
    if (query.lat != null && query.lng != null) {
      const radius = query.radiusKm ?? 50;
      const origin = { lat: query.lat, lng: query.lng };
      result = venues
        .map((v) => ({ v, dist: haversineKm(origin, { lat: v.lat, lng: v.lng }) }))
        .filter((x) => x.dist <= radius)
        .sort((a, b) => a.dist - b.dist)
        .map((x) => x.v);
    }
    return result.slice(0, 60).map((v) => this.card(v));
  }

  /** Venue profile: details, upcoming events here, visible reviews, aggregates. */
  async profile(id: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id },
      include: { business: { select: { id: true, name: true, status: true, logoUrl: true } } },
    });
    if (!venue) throw new NotFoundException('Venue not found.');

    const [events, reviews] = await Promise.all([
      this.prisma.event.findMany({
        where: { venueId: id, status: 'LIVE', startsAt: { gte: new Date() } },
        orderBy: { startsAt: 'asc' },
        take: 20,
        select: {
          id: true,
          title: true,
          startsAt: true,
          host: { select: { name: true } },
          activityType: { select: { name: true } },
        },
      }),
      this.prisma.venueReview.findMany({
        where: { venueId: id, status: 'VISIBLE' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { name: true, photoUrl: true } } },
      }),
    ]);

    return {
      ...this.card(venue),
      description: venue.description ?? '',
      amenities: (venue.amenities as string[] | null) ?? [],
      hours: (venue.hours as Record<string, string> | null) ?? {},
      phone: venue.phone ?? null,
      website: venue.website ?? null,
      business: venue.business
        ? { id: venue.business.id, name: venue.business.name, verified: venue.business.status === 'VERIFIED', logoUrl: venue.business.logoUrl ?? null }
        : null,
      upcomingEvents: events.map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: e.startsAt.toISOString(),
        activityType: e.activityType.name,
        hostName: e.host.name,
      })),
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        text: r.text ?? '',
        authorName: r.user.name,
        authorPhoto: r.user.photoUrl ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  /** Create a venue for a business (caller is MANAGER+, enforced by guard). */
  async create(dto: CreateVenueDto) {
    const business = await this.prisma.business.findUnique({ where: { id: dto.businessId } });
    if (!business) throw new NotFoundException('Business not found.');
    const venue = await this.prisma.venue.create({
      data: {
        businessId: dto.businessId,
        name: dto.name,
        slug: await this.uniqueSlug(dto.name),
        category: dto.category,
        description: dto.description,
        address: dto.address,
        lat: dto.lat,
        lng: dto.lng,
        photos: dto.photos ?? undefined,
        amenities: dto.amenities ?? undefined,
        hours: dto.hours ?? undefined,
        phone: dto.phone,
        website: dto.website,
        // Owned from creation; VERIFIED business → VERIFIED venue badge.
        status: business.status === 'VERIFIED' ? 'VERIFIED' : 'CLAIMED',
      },
    });
    return this.card(venue);
  }

  async update(userId: string, id: string, dto: UpdateVenueDto) {
    const venue = await this.prisma.venue.findUnique({ where: { id } });
    if (!venue) throw new NotFoundException('Venue not found.');
    if (!venue.businessId) throw new BadRequestException('This venue is unclaimed — claim it first.');
    await this.access.assertRole(userId, venue.businessId, 'MANAGER');
    const updated = await this.prisma.venue.update({ where: { id }, data: { ...dto } });
    return this.card(updated);
  }

  /** Submit a claim for an unclaimed venue (caller is MANAGER+ of the claiming business). */
  async claim(userId: string, venueId: string, dto: ClaimVenueDto, files: UploadFile[] = []) {
    await this.access.assertRole(userId, dto.businessId, 'MANAGER');
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Venue not found.');
    if (venue.businessId) throw new BadRequestException('This venue is already claimed.');

    const existing = await this.prisma.venueClaim.findFirst({ where: { venueId, status: 'PENDING' } });
    if (existing) throw new BadRequestException('A claim for this venue is already pending review.');

    const uploaded = await Promise.all(
      (files ?? []).filter((f) => f.mimetype).map((f) => this.storage.save(f, 'venue-claim')),
    );
    const evidence = [...(dto.evidence ?? []), ...uploaded];
    const claim = await this.prisma.venueClaim.create({
      data: { venueId, businessId: dto.businessId, evidence, status: 'PENDING' },
    });
    await this.notifications.notifyAdmins({
      type: 'admin',
      title: 'Venue claim submitted',
      body: `A business submitted a claim for venue “${venue.name}”.`,
    });
    return { id: claim.id, status: claim.status.toLowerCase() };
  }

  /** Review a venue — only if the caller attended an event held at it. */
  async addReview(userId: string, venueId: string, dto: CreateVenueReviewDto) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException('Venue not found.');

    const attendance = await this.prisma.attendance.findFirst({
      where: { userId, status: 'JOINED', event: { venueId } },
      orderBy: { joinedAt: 'desc' },
      select: { eventId: true },
    });
    if (!attendance) {
      throw new BadRequestException('You can only review a venue you attended an event at.');
    }

    const existing = await this.prisma.venueReview.findUnique({
      where: { venueId_userId: { venueId, userId } },
    });
    if (existing) throw new BadRequestException('You already reviewed this venue.');

    const review = await this.prisma.venueReview.create({
      data: { venueId, userId, rating: dto.rating, text: dto.text, attendedEventId: attendance.eventId },
    });
    await this.recomputeRating(venueId);
    return { id: review.id, rating: review.rating, text: review.text ?? '' };
  }

  // --- helpers ------------------------------------------------------------

  private async recomputeRating(venueId: string) {
    const agg = await this.prisma.venueReview.aggregate({
      where: { venueId, status: 'VISIBLE' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await this.prisma.venue.update({
      where: { id: venueId },
      data: {
        avgRating: agg._avg.rating ?? 0,
        reviewCount: agg._count._all,
      },
    });
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'venue';
    for (let i = 0; i < 5; i++) {
      const slug = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
      const taken = await this.prisma.venue.findUnique({ where: { slug } });
      if (!taken) return slug;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  private card(v: Venue) {
    return {
      id: v.id,
      businessId: v.businessId ?? null,
      name: v.name,
      slug: v.slug,
      category: v.category,
      address: v.address,
      lat: v.lat,
      lng: v.lng,
      photos: (v.photos as string[] | null) ?? [],
      status: v.status.toLowerCase(),
      avgRating: Number(v.avgRating),
      reviewCount: v.reviewCount,
    };
  }
}
