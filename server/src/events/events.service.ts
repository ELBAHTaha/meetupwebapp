import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityTypesService } from '../activity-types/activity-types.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { eventInclude, serializeEvent } from '../common/serializers/event.serializer';
import { looksLikePrivatePlace } from '../common/utils/private-place';
import { haversineKm } from '../common/utils/haversine';
import { ActivityCategory, GenderPreference, Prisma, Visibility } from '@prisma/client';
import { SubscriptionService } from '../monetization/subscription.service';
import { ExpressPaymentService } from '../monetization/express-payment.service';
import { BusinessService } from '../monetization/business.service';

const FOUR_HOURS = 4 * 60 * 60 * 1000;
const THIRTY_MIN = 30 * 60 * 1000;
const CHAT_TTL = 24 * 60 * 60 * 1000;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityTypes: ActivityTypesService,
    private readonly geocoding: GeocodingService,
    private readonly notifications: NotificationsService,
    private readonly subscriptions: SubscriptionService,
    private readonly expressPayments: ExpressPaymentService,
    private readonly businesses: BusinessService,
  ) {}

  // --- guards -------------------------------------------------------------
  private async ensureActive(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Account not found.');
    if (user.status === 'SUSPENDED' && user.suspendedUntil && user.suspendedUntil < new Date()) {
      await this.prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE', suspendedUntil: null } });
      return;
    }
    if (user.status === 'BANNED') throw new ForbiddenException('Your account is banned.');
    if (user.status === 'SUSPENDED') throw new ForbiddenException('Your account is suspended.');
  }

  private loadOrThrow(id: string, viewerId?: string) {
    return this.prisma.event
      .findUnique({ where: { id }, include: eventInclude })
      .then((e) => {
        if (!e) throw new NotFoundException('Activity not found.');
        return e;
      });
  }

  // --- create -------------------------------------------------------------
  async create(userId: string, dto: CreateEventDto): Promise<unknown> {
    await this.ensureActive(userId);
    const mustPayForExtra = await this.subscriptions.requiresExtraEventPayment(userId);

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const now = new Date();
    if (startsAt.getTime() - now.getTime() < FOUR_HOURS) {
      throw new UnprocessableEntityException('Activities must start more than 4 hours from now.');
    }
    if (startsAt.toDateString() === now.toDateString()) {
      throw new UnprocessableEntityException('No same-day meetups — pick a future day.');
    }
    if (endsAt <= startsAt) throw new BadRequestException('End time must be after the start time.');
    if (dto.isPublicPlace !== true) {
      throw new UnprocessableEntityException('Activities must be at a public place.');
    }
    if (looksLikePrivatePlace(dto.title, dto.address, dto.locationLabel)) {
      throw new UnprocessableEntityException('That looks like a private home — meetups must be at public venues.');
    }

    const activityTypeId = await this.activityTypes.resolveId(dto.activityId);
    if (!activityTypeId) throw new BadRequestException('Unknown activity type.');

    const plan = await this.subscriptions.hostPlanForCreate(userId);
    let priorityLevel: 'STANDARD' | 'EXPRESS' | 'PRIORITY' = plan.premiumPriority ? 'PRIORITY' : 'STANDARD';
    let expressFeePaid = false;
    if (dto.priorityLevel && dto.priorityLevel !== 'standard') {
      if (!dto.expressPaymentIntentId) throw new BadRequestException('Hosting an extra activity requires a successful payment.');
      priorityLevel = await this.expressPayments.verifyPaymentIntent(dto.expressPaymentIntentId, userId, dto.priorityLevel);
      expressFeePaid = true;
    }

    // Free hosts get one activity per rolling week. Beyond that they must pay
    // the one-time extra-activity fee ($0.99, or $2.99 for featured placement);
    // active paid plans are treated as unlimited by the weekly check above.
    if (mustPayForExtra && !expressFeePaid) {
      throw new BadRequestException(
        'You’ve used your free activity this week. Pay the one-time fee to host another, or upgrade to Pro for unlimited hosting.',
      );
    }

    // Featured/pinned placement:
    //  • paid subscribers (Pro pinnedUntil / Premium premiumPriority)
    //  • $2.99 "priority" extra always pins
    //  • $0.99 "express" pins only on the host's free (first) activity of the
    //    week — there the fee buys the pin, not the activity slot itself.
    const pinFromExpress = !mustPayForExtra && priorityLevel === 'EXPRESS';
    const pinnedUntil =
      plan.pinnedUntil ??
      (priorityLevel === 'PRIORITY' || pinFromExpress ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined);

    const event = await this.prisma.event.create({
      data: {
        hostId: userId,
        activityTypeId,
        title: dto.title.slice(0, 60),
        description: dto.description,
        locationLabel: dto.locationLabel,
        address: dto.address,
        lat: dto.lat,
        lng: dto.lng,
        isPublicPlace: true,
        startsAt,
        endsAt,
        maxAttendees: dto.maxAttendees,
        minPlayers: Math.min(dto.minPlayers ?? 1, dto.maxAttendees),
        skillLevel: dto.skillLevel,
        price: dto.price ?? 0,
        travelersWelcome: dto.travelersWelcome ?? true,
        genderPreference: (dto.genderPreference?.toUpperCase() as GenderPreference) ?? 'ANY',
        visibility: (dto.visibility?.toUpperCase() as Visibility) ?? 'PUBLIC',
        status: 'LIVE', // live immediately — no approval step
        priorityLevel,
        expressPaymentIntentId: dto.expressPaymentIntentId,
        expressFeePaid,
        approvedAt: new Date(),
        pinnedUntil,
        chatThread: { create: { expiresAt: new Date(endsAt.getTime() + CHAT_TTL) } },
      },
      include: eventInclude,
    });

    await this.businesses.trackVenueUsage(dto.businessId, event.id);

    await this.notifications.push({
      userId,
      type: 'confirmed',
      title: 'Your activity is live 🎉',
      body: `“${event.title}” is now visible in the feed.`,
      eventId: event.id,
    });

    return serializeEvent(event, userId);
  }

  // --- list (public) ------------------------------------------------------
  async list(query: QueryEventsDto, viewerId?: string): Promise<{ items: unknown[]; page: number; limit: number; total: number }> {
    const where: Prisma.EventWhereInput = {
      status: 'LIVE',
      visibility: 'PUBLIC',
      endsAt: { gt: new Date() },
    };

    if (query.typeId) {
      const id = await this.activityTypes.resolveId(query.typeId);
      where.activityTypeId = id ?? '__none__';
    }
    if (query.category) where.activityType = { category: query.category.toUpperCase() as ActivityCategory };
    if (query.vibe) where.activityType = { ...(where.activityType as object), vibe: query.vibe.toUpperCase() as 'CHILL' | 'ACTIVE' };
    if (query.skillLevel && query.skillLevel !== 'any') where.skillLevel = query.skillLevel;
    if (query.travelersWelcome === 'true') where.travelersWelcome = true;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
        { locationLabel: { contains: query.search } },
      ];
    }

    // Date window
    const now = new Date();
    if (query.when && query.when !== 'all') {
      const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (query.when === 'today') {
        const start = startOfDay(now);
        where.startsAt = { gte: now, lt: new Date(start.getTime() + 86_400_000) };
      } else if (query.when === 'tomorrow') {
        const start = new Date(startOfDay(now).getTime() + 86_400_000);
        where.startsAt = { gte: start, lt: new Date(start.getTime() + 86_400_000) };
      } else if (query.when === 'weekend') {
        where.startsAt = { gte: now, lt: new Date(now.getTime() + 7 * 86_400_000) };
      }
    }

    let events = await this.prisma.event.findMany({
      where,
      include: eventInclude,
      orderBy: [{ pinnedUntil: 'desc' }, { startsAt: 'asc' }],
    });

    // 'weekend' refine to Sat/Sun
    if (query.when === 'weekend') {
      events = events.filter((e) => [0, 6].includes(new Date(e.startsAt).getDay()));
    }

    // City scope: keep only events whose nearest city centre is the chosen city
    // (events are stored by lat/lng, not a city name).
    if (query.city) {
      // Strip diacritics so "Salé" matches the ascii city key "sale".
      const target = query.city.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
      events = events.filter((e) => this.geocoding.nearestCity({ lat: e.lat, lng: e.lng }) === target);
    }

    let serialized = events.map((e) => serializeEvent(e, viewerId));

    if (query.openOnly === 'true') serialized = serialized.filter((e: any) => e.openSpots > 0);

    // Distance sort
    const origin =
      query.lat != null && query.lng != null
        ? { lat: query.lat, lng: query.lng }
        : query.zip
          ? this.geocoding.geocode(query.zip)
          : query.city
            ? this.geocoding.cityCentre(query.city)
            : null;
    if (query.sort === 'distance' && origin) {
      serialized = serialized.sort(
        (a: any, b: any) => haversineKm(origin, a.resolvedLocation) - haversineKm(origin, b.resolvedLocation),
      );
    }

    const total = serialized.length;
    const start = (query.page - 1) * query.limit;
    const items = serialized.slice(start, start + query.limit);
    return { items, page: query.page, limit: query.limit, total };
  }

  async detail(id: string, viewerId?: string): Promise<unknown> {
    const e = await this.loadOrThrow(id, viewerId);
    return serializeEvent(e, viewerId);
  }

  async attendees(id: string): Promise<unknown> {
    const e = await this.loadOrThrow(id);
    const s = serializeEvent(e) as any;
    return { attendees: s.attendees, attendeeUsers: s.attendeeUsers, host: s.host };
  }

  // --- my events ----------------------------------------------------------
  /**
   * Every event the user hosts or has joined, split into the three buckets the
   * "My Events" / profile screens render. viewerStatus (computed per-viewer by
   * the serializer) is the source of truth: 'past' wins for any ended event the
   * viewer took part in, otherwise 'host' / 'joined' / 'waitlisted'.
   */
  async mine(userId: string): Promise<{ hosting: unknown[]; going: unknown[]; past: unknown[] }> {
    const events = await this.prisma.event.findMany({
      where: {
        status: { not: 'CANCELLED' },
        OR: [{ hostId: userId }, { attendances: { some: { userId } } }],
      },
      include: eventInclude,
      orderBy: { startsAt: 'asc' },
    });
    const serialized = events.map((e) => serializeEvent(e, userId)) as any[];
    const byDateAsc = (a: any, b: any) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    return {
      hosting: serialized.filter((e) => e.viewerStatus === 'host').sort(byDateAsc),
      going: serialized
        .filter((e) => e.viewerStatus === 'joined' || e.viewerStatus === 'waitlisted')
        .sort(byDateAsc),
      // Most-recent first for past.
      past: serialized.filter((e) => e.viewerStatus === 'past').sort((a, b) => byDateAsc(b, a)),
    };
  }

  // --- mutations ----------------------------------------------------------
  async update(id: string, userId: string, dto: UpdateEventDto): Promise<unknown> {
    const e = await this.loadOrThrow(id);
    if (e.hostId !== userId) throw new ForbiddenException('Only the host can edit this activity.');
    if (e.startedAt) throw new BadRequestException('You can’t edit an activity that has already started.');

    const data: Prisma.EventUpdateInput = {
      title: dto.title?.slice(0, 60),
      description: dto.description,
      locationLabel: dto.locationLabel,
      address: dto.address,
      lat: dto.lat,
      lng: dto.lng,
      skillLevel: dto.skillLevel,
      price: dto.price,
      travelersWelcome: dto.travelersWelcome,
      maxAttendees: dto.maxAttendees,
      minPlayers: dto.minPlayers,
      genderPreference: dto.genderPreference ? (dto.genderPreference.toUpperCase() as GenderPreference) : undefined,
      visibility: dto.visibility ? (dto.visibility.toUpperCase() as Visibility) : undefined,
    };
    if (dto.startsAt) data.startsAt = new Date(dto.startsAt);
    if (dto.endsAt) data.endsAt = new Date(dto.endsAt);

    await this.prisma.event.update({ where: { id }, data });
    return this.detail(id, userId);
  }

  async cancel(id: string, userId: string): Promise<unknown> {
    const e = await this.loadOrThrow(id);
    if (e.hostId !== userId) throw new ForbiddenException('Only the host can cancel this activity.');
    await this.prisma.event.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.notifications.pushMany(
      e.attendances.map((a) => ({
        userId: a.userId,
        type: 'admin',
        title: 'Activity cancelled',
        body: `“${e.title}” was cancelled by the host.`,
        eventId: e.id,
      })),
    );
    return this.detail(id, userId);
  }

  async start(id: string, userId: string, note?: string): Promise<unknown> {
    const e = await this.loadOrThrow(id);
    if (e.hostId !== userId) throw new ForbiddenException('Only the host can start the activity.');
    if (new Date(e.startsAt).getTime() - Date.now() > THIRTY_MIN) {
      throw new BadRequestException('You can start the activity 30 minutes before it begins.');
    }
    const spotNote = note || 'I’ll wave when I see you';
    await this.prisma.event.update({ where: { id }, data: { startedAt: new Date(), hostSpotNote: spotNote } });
    await this.notifications.pushMany(
      e.attendances.map((a) => ({
        userId: a.userId,
        type: 'start',
        title: 'Your host is here 👋',
        body: `Look for ${e.host.name}: “${spotNote}”`,
        eventId: e.id,
      })),
    );
    return this.detail(id, userId);
  }

  async join(id: string, userId: string): Promise<{ event: unknown; message: string }> {
    await this.ensureActive(userId);
    const e = await this.loadOrThrow(id);
    if (e.status !== 'LIVE' || new Date(e.endsAt) < new Date()) {
      throw new BadRequestException('This activity is no longer open to join.');
    }
    if (e.hostId === userId) throw new BadRequestException('You are the host of this activity.');
    if (e.attendances.some((a) => a.userId === userId)) {
      throw new BadRequestException('You have already joined this activity.');
    }
    // Gender preference
    if (e.genderPreference !== 'ANY') {
      const me = await this.prisma.user.findUnique({ where: { id: userId } });
      const needed = e.genderPreference === 'WOMEN' ? 'FEMALE' : 'MALE';
      if (me?.gender !== needed) {
        throw new ForbiddenException(`This activity is ${e.genderPreference.toLowerCase()} only.`);
      }
    }

    const going = 1 + e.attendances.filter((a) => a.status === 'JOINED').length;
    const full = going >= e.maxAttendees;
    const waitlistCount = e.attendances.filter((a) => a.status === 'WAITLISTED').length;

    await this.prisma.attendance.create({
      data: {
        eventId: id,
        userId,
        status: full ? 'WAITLISTED' : 'JOINED',
        waitlistPosition: full ? waitlistCount + 1 : null,
      },
    });

    const fresh = await this.loadOrThrow(id, userId);
    const message = full
      ? `You're #${waitlistCount + 1} on the waitlist for “${e.title}”.`
      : `Meeting at ${e.locationLabel}, ${new Date(e.startsAt).toLocaleString()} — see you there!`;
    return { event: serializeEvent(fresh, userId), message };
  }

  async leave(id: string, userId: string): Promise<unknown> {
    const e = await this.loadOrThrow(id);
    if (e.hostId === userId) throw new BadRequestException('Hosts cancel instead of leaving.');
    const mine = e.attendances.find((a) => a.userId === userId);
    if (!mine) throw new BadRequestException('You are not part of this activity.');

    await this.prisma.attendance.delete({ where: { eventId_userId: { eventId: id, userId } } });

    // Promote the first waitlisted person if a JOINED spot freed up.
    if (mine.status === 'JOINED') {
      const next = await this.prisma.attendance.findFirst({
        where: { eventId: id, status: 'WAITLISTED' },
        orderBy: { joinedAt: 'asc' },
      });
      if (next) {
        await this.prisma.attendance.update({
          where: { id: next.id },
          data: { status: 'JOINED', waitlistPosition: null },
        });
        await this.notifications.push({
          userId: next.userId,
          type: 'confirmed',
          title: 'A spot opened up 🎉',
          body: `You’re in for “${e.title}” — see you there!`,
          eventId: id,
        });
      }
    }
    // Renumber remaining waitlist.
    const waiting = await this.prisma.attendance.findMany({
      where: { eventId: id, status: 'WAITLISTED' },
      orderBy: { joinedAt: 'asc' },
    });
    await Promise.all(
      waiting.map((w, i) => this.prisma.attendance.update({ where: { id: w.id }, data: { waitlistPosition: i + 1 } })),
    );

    return this.detail(id, userId);
  }
}
