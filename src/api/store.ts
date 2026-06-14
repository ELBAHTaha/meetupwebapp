import type {
  Activity,
  AppNotification,
  ChatThread,
  Conditions,
  EnrichedEvent,
  EventLocation,
  JmaaEvent,
  Rating,
  Report,
  Review,
  Spot,
  User,
  ViewerRsvp,
} from '@/types';
import { SEED_ACTIVITIES } from './catalog';
import {
  CURRENT_USER_ID,
  SEED_CONDITIONS,
  SEED_EVENTS,
  SEED_NOTIFICATIONS,
  SEED_RATINGS,
  SEED_REPORTS,
  SEED_REVIEWS,
  SEED_SPOTS,
  SEED_THREADS,
  SEED_USERS,
} from './seed';

const DAY = 86_400_000;

/** Compute an event's end time (explicit endsAt or startsAt + duration). */
export function endsAtOf(e: Pick<JmaaEvent, 'startsAt' | 'durationMins' | 'endsAt'>): string {
  if (e.endsAt) return e.endsAt;
  return new Date(new Date(e.startsAt).getTime() + e.durationMins * 60_000).toISOString();
}

// Normalize seed records so the new fields are always present at runtime,
// without having to edit every seed literal.
function normalizeEvent(e: JmaaEvent): JmaaEvent {
  const ends = endsAtOf(e);
  const past = new Date(e.startsAt).getTime() < Date.now();
  return {
    ...e,
    endsAt: ends,
    genderPreference: e.genderPreference ?? 'any',
    lifecycle: e.lifecycle ?? (past ? 'completed' : 'live'),
  };
}

function normalizeThread(t: ChatThread): ChatThread {
  if (t.expiresAt || !t.eventId) return t;
  const ev = SEED_EVENTS.find((e) => e.id === t.eventId);
  return ev ? { ...t, expiresAt: new Date(new Date(endsAtOf(ev)).getTime() + DAY).toISOString() } : t;
}

// ---------------------------------------------------------------------------
// Mutable in-memory store. In a real app this lives behind the REST API; here
// it's a session-scoped singleton that the mock API reads and writes.
// ---------------------------------------------------------------------------
interface Store {
  users: User[];
  activities: Activity[];
  spots: Spot[];
  events: JmaaEvent[];
  conditions: Conditions[];
  threads: ChatThread[];
  reviews: Review[];
  ratings: Rating[];
  reports: Report[];
  notifications: AppNotification[];
  currentUserId: string;
}

function freshSeed(): Store {
  return {
    users: structuredClone(SEED_USERS),
    activities: structuredClone(SEED_ACTIVITIES),
    spots: structuredClone(SEED_SPOTS),
    events: structuredClone(SEED_EVENTS).map(normalizeEvent),
    conditions: structuredClone(SEED_CONDITIONS),
    threads: structuredClone(SEED_THREADS).map(normalizeThread),
    reviews: structuredClone(SEED_REVIEWS),
    ratings: structuredClone(SEED_RATINGS),
    reports: structuredClone(SEED_REPORTS),
    notifications: structuredClone(SEED_NOTIFICATIONS),
    currentUserId: CURRENT_USER_ID,
  };
}

// ---------------------------------------------------------------------------
// Persistence. The mock db is normally in-memory and re-seeds on every page
// load — which means a join/RSVP or a freshly created event vanishes on the
// next refresh (the auth session survives, so it *looks* like the same session
// but the data is gone). We persist the mutable collections to localStorage so
// those survive reloads. Seed dates are relative to first-load `now`, so we
// discard anything older than a day to avoid "all events are in the past" drift.
// ---------------------------------------------------------------------------
const PERSIST_KEY = 'jmaa-db-v1';
const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000; // 1 day

interface PersistedDb {
  savedAt: number;
  users: User[];
  events: JmaaEvent[];
  threads: ChatThread[];
  reviews: Review[];
  ratings: Rating[];
  reports: Report[];
  notifications: AppNotification[];
}

function loadDb(): Store {
  const base = freshSeed();
  if (typeof localStorage === 'undefined') return base;
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as PersistedDb;
    if (!saved.savedAt || Date.now() - saved.savedAt > PERSIST_MAX_AGE) {
      localStorage.removeItem(PERSIST_KEY);
      return base;
    }
    return {
      ...base,
      users: saved.users ?? base.users,
      events: saved.events ?? base.events,
      threads: saved.threads ?? base.threads,
      reviews: saved.reviews ?? base.reviews,
      ratings: saved.ratings ?? base.ratings,
      reports: saved.reports ?? base.reports,
      notifications: saved.notifications ?? base.notifications,
    };
  } catch {
    return base;
  }
}

export const db: Store = loadDb();

/** Persist the mutable parts of the db. Called after every mutation. */
export function saveDb(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const payload: PersistedDb = {
      savedAt: Date.now(),
      users: db.users,
      events: db.events,
      threads: db.threads,
      reviews: db.reviews,
      ratings: db.ratings,
      reports: db.reports,
      notifications: db.notifications,
    };
    localStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / serialization errors — persistence is best-effort */
  }
}

export const findUser = (id: string) => db.users.find((u) => u.id === id);
export const findActivity = (id: string) => db.activities.find((a) => a.id === id);
export const findSpot = (id?: string) => (id ? db.spots.find((s) => s.id === id) : undefined);
export const findEvent = (id: string) => db.events.find((e) => e.id === id);

const goingCountOf = (e: JmaaEvent) =>
  e.attendees.filter((a) => a.status === 'going' || a.status === 'host').length;

const isPast = (e: JmaaEvent) => new Date(e.startsAt).getTime() < Date.now();

/** Recompute the team-sport / capacity status of an event in place. */
export function recomputeStatus(e: JmaaEvent): void {
  if (isPast(e)) {
    e.status = 'PAST';
    return;
  }
  const going = goingCountOf(e);
  if (going >= e.capacity) e.status = 'FULL';
  else if (going >= e.minPlayers) e.status = 'CONFIRMED';
  else e.status = 'PENDING';
}

/** Renumber waitlist positions after any membership change. */
function renumberWaitlist(e: JmaaEvent): void {
  let pos = 1;
  e.attendees
    .filter((a) => a.status === 'waitlisted')
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())
    .forEach((a) => {
      a.waitPosition = pos++;
    });
}

export function viewerStatusOf(e: JmaaEvent, userId: string): ViewerRsvp {
  if (isPast(e)) {
    return e.attendees.some((a) => a.userId === userId) ? 'past' : 'past';
  }
  const me = e.attendees.find((a) => a.userId === userId);
  if (!me) return 'not_joined';
  if (me.status === 'host') return 'host';
  if (me.status === 'waitlisted') return 'waitlisted';
  return 'joined';
}

export function resolvedLocationOf(e: JmaaEvent): EventLocation {
  const spot = findSpot(e.spotId);
  if (spot) return { lat: spot.lat, lng: spot.lng, label: spot.name };
  return e.location ?? { lat: 33.5731, lng: -7.5898, label: 'Location TBD' };
}

export function enrich(e: JmaaEvent, viewerId = db.currentUserId): EnrichedEvent {
  const activity = findActivity(e.activityId)!;
  const host = findUser(e.hostId)!;
  const spot = findSpot(e.spotId);
  const goingCount = goingCountOf(e);
  const waitlistCount = e.attendees.filter((a) => a.status === 'waitlisted').length;
  return {
    ...e,
    activity,
    host,
    spot,
    goingCount,
    waitlistCount,
    openSpots: Math.max(0, e.capacity - goingCount),
    viewerStatus: viewerStatusOf(e, viewerId),
    resolvedLocation: resolvedLocationOf(e),
  };
}

// ---- Mutations -------------------------------------------------------------

export function joinEventInStore(eventId: string, userId: string): void {
  const e = findEvent(eventId);
  if (!e) return;
  if (e.attendees.some((a) => a.userId === userId)) return;
  const going = goingCountOf(e);
  if (going < e.capacity) {
    e.attendees.push({ userId, status: 'going', joinedAt: new Date().toISOString() });
  } else {
    e.attendees.push({ userId, status: 'waitlisted', joinedAt: new Date().toISOString() });
  }
  renumberWaitlist(e);
  recomputeStatus(e);
  ensureEventThread(e, userId);
}

export function leaveEventInStore(eventId: string, userId: string): void {
  const e = findEvent(eventId);
  if (!e) return;
  const me = e.attendees.find((a) => a.userId === userId);
  if (!me || me.status === 'host') return;
  const wasGoing = me.status === 'going';
  e.attendees = e.attendees.filter((a) => a.userId !== userId);
  // Promote the first waitlisted person into the freed spot.
  if (wasGoing) {
    const next = e.attendees
      .filter((a) => a.status === 'waitlisted')
      .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())[0];
    if (next) {
      next.status = 'going';
      delete next.waitPosition;
    }
  }
  renumberWaitlist(e);
  recomputeStatus(e);
}

/** Make sure an event's group chat exists and the user is a participant. */
export function ensureEventThread(e: JmaaEvent, userId: string): ChatThread {
  let thread = db.threads.find((t) => t.eventId === e.id);
  if (!thread) {
    thread = {
      id: e.id,
      eventId: e.id,
      title: e.title,
      participantIds: [e.hostId],
      messages: [],
      expiresAt: new Date(new Date(endsAtOf(e)).getTime() + DAY).toISOString(),
    };
    db.threads.push(thread);
  }
  if (!thread.participantIds.includes(userId)) thread.participantIds.push(userId);
  return thread;
}

export const threadExpired = (t: ChatThread) =>
  !!t.expiresAt && new Date(t.expiresAt).getTime() < Date.now();

let seq = 1000;
export const nextId = (prefix: string) => `${prefix}${seq++}`;

// ---- Trust, ratings & flagging --------------------------------------------

/** Recompute a user's trust score (avg of received ratings) + flag count. */
export function recomputeTrust(userId: string): void {
  const u = findUser(userId);
  if (!u) return;
  const received = db.ratings.filter((r) => r.toUserId === userId);
  u.trustScore = received.length
    ? Number((received.reduce((s, r) => s + r.score, 0) / received.length).toFixed(2))
    : 5.0;
  // A flag = a distinct activity in which the user was rated 1–2 stars.
  const flaggedActivities = new Set(received.filter((r) => r.score <= 2).map((r) => r.activityId));
  u.flagCount = flaggedActivities.size;
}

export const reportCountForUser = (userId: string) =>
  db.reports.filter((r) => r.targetType === 'user' && r.targetId === userId).length;

/** Admin "flagged" criteria: low trust, ≥2 flags, or ≥2 reports. */
export function isFlagged(u: User): boolean {
  return (
    (db.ratings.some((r) => r.toUserId === u.id) && u.trustScore < 2.5) ||
    u.flagCount >= 2 ||
    reportCountForUser(u.id) >= 2
  );
}

// ---- Account guards --------------------------------------------------------

/** Lapse any expired suspension, then report whether the user may act. */
export function refreshSuspension(u: User): void {
  if (u.status === 'suspended' && u.suspendedUntil && new Date(u.suspendedUntil).getTime() < Date.now()) {
    u.status = 'active';
    u.suspendedUntil = undefined;
  }
}

export function actionBlockReason(userId: string): string | null {
  const u = findUser(userId);
  if (!u) return 'Account not found.';
  refreshSuspension(u);
  if (u.status === 'banned') return 'Your account is banned.';
  if (u.status === 'suspended') return 'Your account is suspended.';
  return null;
}

// ---- Lifecycle mutations ---------------------------------------------------

export function startActivityInStore(eventId: string, note: string): void {
  const e = findEvent(eventId);
  if (!e) return;
  e.startedAt = new Date().toISOString();
  e.hostSpotNote = note;
}

export function addRatingInStore(
  fromUserId: string,
  input: { toUserId: string; activityId: string; score: number; type: Rating['type'] },
): Rating {
  const rating: Rating = {
    id: nextId('rt-'),
    fromUserId,
    toUserId: input.toUserId,
    activityId: input.activityId,
    score: input.score,
    type: input.type,
    private: true,
    createdAt: new Date().toISOString(),
  };
  db.ratings.push(rating);
  recomputeTrust(input.toUserId);
  return rating;
}

export function addReportInStore(
  reporterId: string,
  input: { targetType: Report['targetType']; targetId: string; reason: string; chatThreadId?: string },
): Report {
  const report: Report = {
    id: nextId('rp-'),
    reporterId,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    chatThreadId: input.chatThreadId,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  db.reports.push(report);
  return report;
}

export function pushNotification(n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): void {
  db.notifications.push({
    ...n,
    id: nextId('n-'),
    createdAt: new Date().toISOString(),
    read: false,
  });
}

// Recompute trust scores on boot so seed ratings are reflected. Runs last, once
// every `const` helper above (findUser, etc.) is initialized.
db.users.forEach((u) => recomputeTrust(u.id));
