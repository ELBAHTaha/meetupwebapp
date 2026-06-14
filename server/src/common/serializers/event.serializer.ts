import { Prisma } from '@prisma/client';
import { publicUser } from './user.serializer';
import { serializeActivity } from './activity.serializer';

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

  const resolvedLocation = { lat: e.lat, lng: e.lng, label: e.locationLabel };

  return {
    id: e.id,
    activityId: e.activityType.slug,
    title: e.title,
    hostId: e.hostId,
    description: e.description ?? '',
    address: e.address,
    locationLabel: e.locationLabel,
    location: resolvedLocation,
    resolvedLocation,
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
    hostSpotNote: e.hostSpotNote ?? undefined,
    priorityLevel: e.priorityLevel.toLowerCase(),
    expressFeePaid: e.expressFeePaid,
    approvedAt: e.approvedAt ? e.approvedAt.toISOString() : undefined,
    pinnedUntil: e.pinnedUntil ? e.pinnedUntil.toISOString() : undefined,
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
