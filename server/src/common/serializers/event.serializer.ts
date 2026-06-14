import { Prisma } from '@prisma/client';
import { publicUser } from './user.serializer';
import { serializeActivity } from './activity.serializer';
import { nearestCityName } from '../utils/area';

export const eventInclude = {
  host: {
    include: {
      userActivities: { include: { activityType: { select: { slug: true } } } },
      _count: { select: { ratingsReceived: true } },
    },
  },
  activityType: true,
  attendances: {
    include: {
      user: {
        include: {
          userActivities: { include: { activityType: { select: { slug: true } } } },
          _count: { select: { ratingsReceived: true } },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  },
  // Sponsored-venue link (a business hosting at its own venue) — used to pin and
  // badge the activity in the feed.
  venueUsages: {
    where: { isSponsored: true },
    include: { business: { select: { name: true } }, sponsorship: { select: { tier: true } } },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
} satisfies Prisma.EventInclude;

export type EventWithRels = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

type ViewerRsvp = 'not_joined' | 'joined' | 'waitlisted' | 'host' | 'past';

/** Derive the RSVP/capacity status the frontend expects. */
function derivedStatus(e: EventWithRels): { status: 'PENDING' | 'CONFIRMED' | 'FULL' | 'PAST'; going: number } {
  const going = 1 + e.attendances.filter((a) => a.status === 'JOINED').length; // +1 host
  const past = e.status === 'COMPLETED' || new Date(e.endsAt).getTime() < Date.now();
  if (past) return { status: 'PAST', going };
  if (going >= e.maxAttendees) return { status: 'FULL', going };
  if (going >= e.minPlayers) return { status: 'CONFIRMED', going };
  return { status: 'PENDING', going };
}

export function serializeEvent(e: EventWithRels, viewerId?: string) {
  const { status, going } = derivedStatus(e);
  const waitlistCount = e.attendances.filter((a) => a.status === 'WAITLISTED').length;
  const durationMins = Math.max(0, Math.round((new Date(e.endsAt).getTime() - new Date(e.startsAt).getTime()) / 60000));

  const attendees = [
    { userId: e.hostId, status: 'host' as const, joinedAt: e.createdAt.toISOString() },
    ...e.attendances.map((a) => ({
      userId: a.userId,
      status: (a.status === 'JOINED' ? 'going' : 'waitlisted') as 'going' | 'waitlisted',
      waitPosition: a.waitlistPosition ?? undefined,
      joinedAt: a.joinedAt.toISOString(),
    })),
  ];

  let viewerStatus: ViewerRsvp = 'not_joined';
  if (viewerId) {
    if (status === 'PAST' && (e.hostId === viewerId || e.attendances.some((a) => a.userId === viewerId))) {
      viewerStatus = 'past';
    } else if (e.hostId === viewerId) {
      viewerStatus = 'host';
    } else {
      const mine = e.attendances.find((a) => a.userId === viewerId);
      if (mine) viewerStatus = mine.status === 'JOINED' ? 'joined' : 'waitlisted';
    }
  }

  // Progressive disclosure: only members (host/joined/waitlisted/past) see the
  // exact address + pin. Everyone else gets a general area and fuzzed coords.
  const joined =
    viewerStatus === 'host' || viewerStatus === 'joined' || viewerStatus === 'waitlisted' || viewerStatus === 'past';
  const generalArea = e.areaLabel ?? nearestCityName({ lat: e.lat, lng: e.lng }) ?? 'Nearby area';
  const fuzz = (n: number) => Math.round(n * 100) / 100; // ~1km grid
  const resolvedLocation = joined
    ? { lat: e.lat, lng: e.lng, label: e.locationLabel }
    : { lat: fuzz(e.lat), lng: fuzz(e.lng), label: generalArea };

  const venue = e.venueUsages[0];
  const sponsoredVenue =
    venue && venue.sponsorship
      ? { name: venue.business.name, tier: venue.sponsorship.tier.toLowerCase() as 'bronze' | 'silver' | 'gold' }
      : undefined;

  return {
    id: e.id,
    activityId: e.activityType.slug,
    title: e.title,
    hostId: e.hostId,
    description: e.description ?? '',
    address: joined ? e.address : '',
    locationLabel: joined ? e.locationLabel : generalArea,
    location: resolvedLocation,
    resolvedLocation,
    generalArea,
    locationHidden: !joined,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    durationMins,
    capacity: e.maxAttendees,
    minPlayers: e.minPlayers,
    skillLevel: e.skillLevel ?? 'any',
    price: Number(e.price),
    travelersWelcome: e.travelersWelcome,
    visibility: e.visibility.toLowerCase() as 'public' | 'invite',
    genderPreference: e.genderPreference.toLowerCase() as 'any' | 'women' | 'men',
    vibe: e.activityType.vibe.toLowerCase() as 'chill' | 'active',
    isPublicPlace: e.isPublicPlace,
    status,
    lifecycle: e.status.toLowerCase() as 'live' | 'completed' | 'cancelled',
    startedAt: e.startedAt ? e.startedAt.toISOString() : undefined,
    hostConfirmedAt: e.hostConfirmedAt ? e.hostConfirmedAt.toISOString() : undefined,
    hostSpotNote: joined ? e.hostSpotNote ?? undefined : undefined,
    priorityLevel: e.priorityLevel.toLowerCase(),
    expressFeePaid: e.expressFeePaid,
    approvedAt: e.approvedAt ? e.approvedAt.toISOString() : undefined,
    pinnedUntil: e.pinnedUntil ? e.pinnedUntil.toISOString() : undefined,
    sponsoredVenue,
    attendees,
    // Enriched relations (so the frontend doesn't need a separate user store).
    activity: serializeActivity(e.activityType),
    host: publicUser(e.host),
    attendeeUsers: e.attendances.map((a) => publicUser(a.user)),
    goingCount: going,
    waitlistCount,
    openSpots: Math.max(0, e.maxAttendees - going),
    confirmed: going >= e.minPlayers,
    spotsLeft: Math.max(0, e.maxAttendees - going),
    viewerStatus,
  };
}
