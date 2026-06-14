import type {
  Activity,
  AppNotification,
  ChatMessage,
  ChatThread,
  Conditions,
  CreateActivityInput,
  CreateEventInput,
  EnrichedEvent,
  EventFilters,
  JmaaEvent,
  LoginInput,
  MyBusiness,
  Rating,
  RatingInput,
  Report,
  ReportInput,
  Review,
  SignupInput,
  Spot,
  SponsoredVenue,
  User,
} from '@/types';
import { isToday, isTomorrow, isWithinInterval, addDays } from 'date-fns';
import { messageViolation } from '@/lib/messageFilter';
import {
  actionBlockReason,
  addRatingInStore,
  addReportInStore,
  db,
  endsAtOf,
  enrich,
  ensureEventThread,
  findEvent,
  findUser,
  isFlagged,
  joinEventInStore,
  leaveEventInStore,
  nextId,
  pushNotification,
  recomputeStatus,
  recomputeTrust,
  refreshSuspension,
  reportCountForUser,
  saveDb,
  startActivityInStore,
  threadExpired,
} from './store';
import { distanceKm } from '@/lib/format';
import { CITIES } from './catalog';

// Artificial latency so loading states are exercised.
const delay = <T>(value: T, ms = 320): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

// ---- Auth ------------------------------------------------------------------

export async function login(_creds: LoginInput): Promise<User> {
  // Mock: accept anything, return the current user.
  return delay(findUser(db.currentUserId)!, 500);
}

/**
 * Mocked signup. No SMS, no approval gate — the account is active immediately.
 * (A real backend would create a record; here we hydrate the demo user.)
 */
export async function signup(input: SignupInput): Promise<User> {
  const me = findUser(db.currentUserId)!;
  if (input.name) me.name = input.name;
  if (input.city) me.city = input.city;
  if (input.avatar) me.avatar = input.avatar;
  if (input.neighborhood) me.neighborhood = input.neighborhood;
  if (input.zip) me.zip = input.zip;
  if (input.birthday) me.birthday = input.birthday;
  if (input.phone !== undefined) me.phone = input.phone;
  me.status = 'active';
  return delay(me, 500);
}

export async function getCurrentUser(): Promise<User> {
  const me = findUser(db.currentUserId)!;
  refreshSuspension(me);
  return delay(me, 120);
}

export async function updateProfile(patch: Partial<User>): Promise<User> {
  const me = findUser(db.currentUserId)!;
  Object.assign(me, patch);
  return delay(me, 250);
}

// ---- Activities ------------------------------------------------------------

export async function listActivities(): Promise<Activity[]> {
  return delay([...db.activities], 120);
}

const groupToken: Record<string, string> = {
  sport: 'act-clay',
  outdoor: 'act-olive',
  social: 'act-majorelle',
};

export async function createCustomActivity(input: CreateActivityInput): Promise<Activity> {
  const activity: Activity = {
    id: nextId('act-'),
    name: input.name,
    icon: '',
    lucideIcon: input.lucideIcon || 'Sparkles',
    category: input.category,
    group: input.group,
    vibe: input.vibe,
    colorToken: groupToken[input.group] ?? 'act-clay',
    outdoor: input.outdoor,
    isCustom: true,
    createdBy: db.currentUserId,
  };
  db.activities.push(activity);
  return delay(activity, 250);
}

// ---- Spots & conditions ----------------------------------------------------

export async function listSpots(city?: string): Promise<Spot[]> {
  const spots = city ? db.spots.filter((s) => s.city === city) : db.spots;
  return delay([...spots], 120);
}

export async function getConditions(
  spotId: string,
  _activityType?: string,
): Promise<Conditions | null> {
  const c = db.conditions.find((x) => x.spotId === spotId) ?? null;
  return delay(c, 280);
}

// ---- Events ----------------------------------------------------------------

function matches(e: JmaaEvent, f: EventFilters): boolean {
  const enriched = enrich(e);
  if (f.city && enriched.resolvedLocation && enriched.spot?.city && enriched.spot.city !== f.city)
    return false;
  if (f.city && enriched.host.city && !enriched.spot && enriched.host.city !== f.city) return false;
  if (f.activityId && e.activityId !== f.activityId) return false;
  if (f.group && enriched.activity.group !== f.group) return false;
  if (f.vibe && enriched.activity.vibe !== f.vibe) return false;
  if (f.skillLevel && f.skillLevel !== 'any' && e.skillLevel !== f.skillLevel && e.skillLevel !== 'any')
    return false;
  if (f.openSpotsOnly && enriched.openSpots <= 0) return false;
  if (f.travelersOnly && !e.travelersWelcome) return false;
  if (f.date && f.date !== 'any') {
    const d = new Date(e.startsAt);
    if (f.date === 'today' && !isToday(d)) return false;
    if (f.date === 'tomorrow' && !isTomorrow(d)) return false;
    if (f.date === 'week' && !isWithinInterval(d, { start: new Date(), end: addDays(new Date(), 7) }))
      return false;
    if (f.date === 'weekend' && !isWeekend(d)) return false;
  }
  if (f.search) {
    const q = f.search.toLowerCase();
    const hay = `${e.title} ${e.description} ${enriched.activity.name} ${enriched.resolvedLocation.label}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

/** Upcoming weekend = Sat/Sun within the next 7 days. */
function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return (day === 6 || day === 0) && isWithinInterval(d, { start: new Date(), end: addDays(new Date(), 7) });
}

interface ListOpts {
  /** Sort upcoming events by distance from this ZIP's city centre. */
  sort?: 'soon' | 'distance';
  zip?: string;
}

function cityOriginForZip(zip?: string): { lat: number; lng: number } | null {
  if (!zip) return null;
  // Approximate: match the city of any user/spot with this zip prefix → its centre.
  const u = db.users.find((x) => x.zip === zip);
  const city = CITIES.find((c) => c.name === (u?.city ?? ''));
  return city ? { lat: city.lat, lng: city.lng } : null;
}

export async function listEvents(filters: EventFilters = {}, opts: ListOpts = {}): Promise<EnrichedEvent[]> {
  let list = db.events
    .filter((e) => e.status !== 'PAST' && e.lifecycle !== 'cancelled' && e.lifecycle !== 'completed')
    .filter((e) => !e.underReview && !!e.approvedAt)
    .filter((e) => matches(e, filters))
    .map((e) => enrich(e));

  const origin = cityOriginForZip(opts.zip);
  if (opts.sort === 'distance' && origin) {
    list = list.sort((a, b) => distanceKm(origin, a.resolvedLocation) - distanceKm(origin, b.resolvedLocation));
  } else {
    list = list.sort((a, b) => {
      const ap = a.pinnedUntil && new Date(a.pinnedUntil).getTime() > Date.now() ? 1 : 0;
      const bp = b.pinnedUntil && new Date(b.pinnedUntil).getTime() > Date.now() ? 1 : 0;
      return bp - ap || new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    });
  }
  return delay(list, 360);
}

/** Read-only preview for non-authenticated visitors on the landing page. */
export async function listPreviewEvents(limit = 4): Promise<EnrichedEvent[]> {
  const list = db.events
    .filter((e) => e.status !== 'PAST' && e.lifecycle === 'live')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, limit)
    .map((e) => enrich(e));
  return delay(list, 280);
}

export async function getEvent(id: string): Promise<EnrichedEvent | null> {
  const e = findEvent(id);
  return delay(e ? enrich(e) : null, 280);
}

export async function getEventsForUser(
  userId: string,
): Promise<{ hosting: EnrichedEvent[]; going: EnrichedEvent[]; past: EnrichedEvent[] }> {
  const all = db.events.map((e) => enrich(e, userId));
  const byDateAsc = (a: EnrichedEvent, b: EnrichedEvent) =>
    new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  return delay(
    {
      // viewerStatus is computed dynamically from startsAt, so it's always accurate
      // regardless of whether recomputeStatus has been called on the stored event.
      hosting: all.filter((e) => e.viewerStatus === 'host').sort(byDateAsc),
      going: all
        .filter((e) => e.viewerStatus === 'joined' || e.viewerStatus === 'waitlisted')
        .sort(byDateAsc),
      // viewerStatusOf returns 'past' for ALL past events (not just attended), so
      // we combine it with an explicit attendance check.
      past: all
        .filter((e) => e.viewerStatus === 'past' && e.attendees.some((a) => a.userId === userId))
        .sort((a, b) => byDateAsc(b, a)),
    },
    300,
  );
}

const FOUR_HOURS = 4 * 60 * 60 * 1000;

/**
 * Activities a host created in the last rolling 7 days — drives the "1 free
 * activity per week" limit. Counts by creation time (falling back to startsAt
 * for older seed records that predate the createdAt field).
 */
function activitiesHostedThisWeek(userId: string): number {
  const weekAgo = Date.now() - 7 * 86_400_000;
  return db.events.filter(
    (event) => event.hostId === userId && new Date(event.createdAt ?? event.startsAt).getTime() >= weekAgo,
  ).length;
}

/**
 * When a free host's next free activity unlocks: 7 days after the most recent
 * activity in the rolling window ages out. Undefined when none are in-window.
 */
function freeActivityResetsAt(userId: string): string | undefined {
  const weekAgo = Date.now() - 7 * 86_400_000;
  const inWindow = db.events
    .filter((event) => event.hostId === userId && new Date(event.createdAt ?? event.startsAt).getTime() >= weekAgo)
    .map((event) => new Date(event.createdAt ?? event.startsAt).getTime());
  if (!inWindow.length) return undefined;
  return new Date(Math.max(...inWindow) + 7 * 86_400_000).toISOString();
}

/** Create an activity. Goes LIVE immediately — there is no pending/approval state. */
export async function createEvent(input: CreateEventInput & { lat?: number; lng?: number; address?: string }): Promise<EnrichedEvent> {
  const block = actionBlockReason(db.currentUserId);
  if (block) throw new Error(block);
  const me = findUser(db.currentUserId)!;
  const plan = me.subscriptionPlan ?? 'free';
  const paidExtra = input.priorityLevel === 'express' || input.priorityLevel === 'priority';
  const usedThisWeek = activitiesHostedThisWeek(db.currentUserId);
  const mustPay = plan === 'free' && usedThisWeek >= 1;
  if (mustPay && !paidExtra) {
    throw new Error('You’ve used your free activity this week. Pay the one-time fee to host another, or upgrade to Pro for unlimited hosting.');
  }
  // Pinned: subscribers, $2.99 priority extras, and the $0.99 express option on
  // the host's free (first) activity of the week (the fee buys the pin there).
  const pinned =
    plan === 'pro' ||
    plan === 'premium' ||
    input.priorityLevel === 'priority' ||
    (!mustPay && input.priorityLevel === 'express');
  // Launch-safety rules (also enforced in the UI).
  if (!input.publicPlaceConfirmed) throw new Error('Please confirm this is a public place.');
  if (new Date(input.startsAt).getTime() - Date.now() < FOUR_HOURS)
    throw new Error('Activities must start more than 4 hours from now.');

  const { publicPlaceConfirmed: _c, ...rest } = input;
  const event: JmaaEvent = {
    id: nextId('e-'),
    ...rest,
    genderPreference: input.genderPreference ?? 'any',
    hostId: db.currentUserId,
    createdAt: new Date().toISOString(),
    attendees: [{ userId: db.currentUserId, status: 'host', joinedAt: new Date().toISOString() }],
    status: 'PENDING',
    lifecycle: 'live',
    endsAt: endsAtOf({ startsAt: input.startsAt, durationMins: input.durationMins }),
    priorityLevel: input.priorityLevel ?? (plan === 'premium' ? 'priority' : 'standard'),
    expressPaymentIntentId: input.expressPaymentIntentId,
    expressFeePaid: paidExtra,
    // Business-venue activities auto-approve; normal users' wait for admin review.
    approvedAt: input.businessId ? new Date().toISOString() : undefined,
    pinnedUntil: pinned ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() : undefined,
    businessId: input.businessId,
  };
  recomputeStatus(event);
  db.events.push(event);
  ensureEventThread(event, db.currentUserId);
  pushNotification({
    type: 'confirmed',
    title: 'Your activity is live 🎉',
    body: `“${event.title}” is now visible in the feed. Invite people in the group chat!`,
    eventId: event.id,
  });
  // Persist so the new activity (and therefore the weekly free-activity count)
  // survives a page reload — otherwise the limit resets and a free host could
  // create another "free" activity before the 7-day window elapses.
  saveDb();
  return delay(enrich(event), 450);
}

// ---- Monetization ----------------------------------------------------------

const MOCK_SPONSORED_VENUES: SponsoredVenue[] = [
  { id: 'biz-gold', name: 'Station Surf Club', address: 'Ain Diab, Casablanca', lat: 33.594, lng: -7.689, tier: 'gold', used: 8, limit: null, remaining: 'unlimited' },
  { id: 'biz-silver', name: 'Cafe Atlas Boardgames', address: 'Gauthier, Casablanca', lat: 33.589, lng: -7.626, tier: 'silver', used: 9, limit: 15, remaining: 6 },
  { id: 'biz-bronze', name: 'Riad Co-work Garden', address: 'Medina, Rabat', lat: 34.023, lng: -6.841, tier: 'bronze', used: 3, limit: 5, remaining: 2 },
];

export async function getSubscriptionSummary(): Promise<{ remaining: number | 'unlimited'; plan: string; status: string; resetsAt?: string }> {
  const me = findUser(db.currentUserId)!;
  const plan = me.subscriptionPlan ?? 'free';
  if (plan === 'pro' || plan === 'premium') return delay({ remaining: 'unlimited', plan, status: 'active' }, 120);
  const used = activitiesHostedThisWeek(db.currentUserId);
  const remaining = Math.max(0, 1 - used);
  return delay(
    { remaining, plan: 'free', status: 'inactive', resetsAt: remaining === 0 ? freeActivityResetsAt(db.currentUserId) : undefined },
    120,
  );
}

export async function createSubscriptionCheckout(planType: 'pro' | 'premium'): Promise<{ url: string }> {
  const me = findUser(db.currentUserId)!;
  me.subscriptionPlan = planType;
  me.subscriptionStatus = 'active';
  return delay({ url: '/pricing?mockSubscribed=true' }, 250);
}

export async function createPremiumUserCheckout(): Promise<{ url: string }> {
  const me = findUser(db.currentUserId)!;
  me.isPremiumUser = true;
  return delay({ url: '/pricing?mockPremium=true' }, 250);
}

export async function createExpressPaymentIntent(priorityLevel: 'express' | 'priority'): Promise<{ clientSecret: string; amountCents: number }> {
  return delay({ clientSecret: `mock_secret_${priorityLevel}`, amountCents: priorityLevel === 'express' ? 99 : 299 }, 180);
}

export async function listSponsoredVenues(): Promise<SponsoredVenue[]> {
  return delay(MOCK_SPONSORED_VENUES, 180);
}

export async function registerBusiness(input: {
  name: string;
  description?: string;
  address: string;
  lat?: number;
  lng?: number;
  contactEmail: string;
  phone?: string;
}): Promise<{ id: string } & typeof input> {
  return delay({ id: nextId('biz-'), ...input }, 250);
}

export async function createSponsorshipCheckout(_businessId: string, tier: 'bronze' | 'silver' | 'gold'): Promise<{ url: string }> {
  return delay({ url: `/business?mockTier=${tier}` }, 250);
}

let MOCK_BUSINESS: MyBusiness = {
  business: {
    id: 'biz-mock',
    name: 'Café Atlas',
    description: 'Cozy café & boardgame corner in Gauthier.',
    address: 'Gauthier, Casablanca',
    phone: '+212 600-000000',
    contactEmail: 'hello@cafeatlas.ma',
    status: 'approved',
  },
  sponsorship: {
    tier: 'silver',
    status: 'active',
    used: 4,
    limit: 15,
    remaining: 11,
    startDate: new Date(Date.now() - 12 * 86_400_000).toISOString(),
    monthlyPriceCents: 9900,
  },
  activities: [
    { id: 'e2', title: 'Sunday boardgames', activityType: 'Board games', hostName: 'Lena', startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(), couponCode: 'JMAA-ATLAS1' },
    { id: 'e3', title: 'Coffee & code', activityType: 'Coffee', hostName: 'Omar', startsAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), couponCode: 'JMAA-ATLAS2' },
  ],
};

export async function getMyBusiness(): Promise<MyBusiness> {
  return delay(MOCK_BUSINESS, 200);
}

export async function updateMyBusiness(patch: { name?: string; description?: string; address?: string; phone?: string }): Promise<MyBusiness> {
  MOCK_BUSINESS = { ...MOCK_BUSINESS, business: { ...MOCK_BUSINESS.business, ...patch } };
  return delay(MOCK_BUSINESS, 250);
}

/** Join checks: account active (not suspended/banned), not already joined. */
export async function joinEvent(id: string, userId: string = db.currentUserId): Promise<EnrichedEvent> {
  const block = actionBlockReason(userId);
  if (block) throw new Error(block);
  const e = findEvent(id);
  if (!e) throw new Error('Activity not found.');
  if (e.lifecycle === 'cancelled') throw new Error('This activity was cancelled.');
  joinEventInStore(id, userId);
  return delay(enrich(findEvent(id)!), 300);
}

export async function leaveEvent(id: string, userId: string = db.currentUserId): Promise<EnrichedEvent> {
  leaveEventInStore(id, userId);
  return delay(enrich(findEvent(id)!), 300);
}

// ---- Users -----------------------------------------------------------------

export async function getUser(id: string): Promise<User | null> {
  return delay(findUser(id) ?? null, 200);
}

export async function getReviewsForUser(userId: string): Promise<Review[]> {
  return delay(
    db.reviews.filter((r) => r.toUserId === userId),
    250,
  );
}

// ---- Chat ------------------------------------------------------------------

export async function listThreads(userId: string = db.currentUserId): Promise<ChatThread[]> {
  // Hide group chats that have expired (24h after the activity ended).
  const threads = db.threads
    .filter((t) => t.participantIds.includes(userId))
    .filter((t) => !threadExpired(t))
    .sort((a, b) => {
      const am = a.messages[a.messages.length - 1]?.sentAt ?? '';
      const bm = b.messages[b.messages.length - 1]?.sentAt ?? '';
      return bm.localeCompare(am);
    });
  return delay(structuredClone(threads), 280);
}

export async function getThread(id: string): Promise<ChatThread | null> {
  return delay(structuredClone(db.threads.find((t) => t.id === id) ?? null), 200);
}

export async function sendMessage(threadId: string, text: string): Promise<ChatMessage> {
  const violation = messageViolation(text);
  if (violation) throw new Error(violation);
  const thread = db.threads.find((t) => t.id === threadId);
  if (thread && threadExpired(thread)) throw new Error('This group chat has closed.');
  if (actionBlockReason(db.currentUserId)) throw new Error('Your account can’t send messages right now.');
  const msg: ChatMessage = {
    id: nextId('m-'),
    senderId: db.currentUserId,
    text,
    sentAt: new Date().toISOString(),
  };
  if (thread) thread.messages.push(msg);
  return delay(msg, 220);
}

// ---- Notifications ---------------------------------------------------------

export async function listNotifications(): Promise<AppNotification[]> {
  return delay(
    [...db.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    250,
  );
}

export async function markNotificationsRead(): Promise<void> {
  db.notifications.forEach((n) => (n.read = true));
  return delay(undefined, 100);
}

// ---- Activity lifecycle ----------------------------------------------------

const THIRTY_MIN = 30 * 60 * 1000;

/** Host taps "Start activity" (enabled 30 min before start). */
export async function startActivity(id: string, note: string): Promise<EnrichedEvent> {
  const e = findEvent(id);
  if (!e) throw new Error('Activity not found.');
  if (e.hostId !== db.currentUserId) throw new Error('Only the host can start the activity.');
  if (new Date(e.startsAt).getTime() - Date.now() > THIRTY_MIN)
    throw new Error('You can start the activity 30 minutes before it begins.');
  startActivityInStore(id, note);
  const host = findUser(e.hostId)!;
  e.attendees
    .filter((a) => a.status !== 'host')
    .forEach((a) =>
      pushNotification({
        type: 'start',
        title: 'Your host is here 👋',
        body: `Look for ${host.name}: “${note}”`,
        eventId: e.id,
        fromUserId: host.id,
      }),
    );
  return delay(enrich(e), 250);
}

export async function confirmActivity(id: string): Promise<EnrichedEvent> {
  const e = findEvent(id);
  if (!e) throw new Error('Activity not found.');
  if (e.hostId !== db.currentUserId) throw new Error('Only the host can confirm this activity.');
  e.hostConfirmedAt = new Date().toISOString();
  return delay(enrich(e), 200);
}

export async function cancelActivity(id: string): Promise<EnrichedEvent> {
  const e = findEvent(id);
  if (!e) throw new Error('Activity not found.');
  if (e.hostId !== db.currentUserId) throw new Error('Only the host can cancel this activity.');
  e.lifecycle = 'cancelled';
  e.status = 'PAST';
  return delay(enrich(e), 200);
}

/** Whether a "start activity" action is currently allowed for the host. */
export function canStart(e: Pick<JmaaEvent, 'startsAt' | 'startedAt'>): boolean {
  return !e.startedAt && new Date(e.startsAt).getTime() - Date.now() <= THIRTY_MIN;
}

// ---- Ratings & trust -------------------------------------------------------

export async function submitRating(input: RatingInput): Promise<Rating> {
  const rating = addRatingInStore(db.currentUserId, input);
  return delay(rating, 200);
}

/** Whether the current user already rated this person for this activity. */
export async function hasRated(toUserId: string, activityId: string): Promise<boolean> {
  return delay(
    db.ratings.some(
      (r) => r.fromUserId === db.currentUserId && r.toUserId === toUserId && r.activityId === activityId,
    ),
    80,
  );
}

/** People the current user still needs to rate for a completed event. */
export async function getRateablePeople(
  eventId: string,
): Promise<{ user: User; type: Rating['type'] }[]> {
  const e = findEvent(eventId);
  if (!e) return delay([], 120);
  const meIsHost = e.hostId === db.currentUserId;
  const targets = meIsHost
    ? e.attendees.filter((a) => a.status !== 'host')
    : e.attendees.filter((a) => a.status === 'host');
  const out = targets
    .map((a) => findUser(a.userId))
    .filter((u): u is User => !!u)
    .filter(
      (u) => !db.ratings.some((r) => r.fromUserId === db.currentUserId && r.toUserId === u.id && r.activityId === eventId),
    )
    .map((u) => ({ user: u, type: (meIsHost ? 'host_to_attendee' : 'attendee_to_host') as Rating['type'] }));
  return delay(out, 200);
}

// ---- Reports ---------------------------------------------------------------

export async function reportTarget(input: ReportInput): Promise<Report> {
  const report = addReportInStore(db.currentUserId, input);
  // Reported activities are hidden pending review (parity with the backend).
  if (input.targetType === 'activity') {
    const e = findEvent(input.targetId);
    if (e) e.underReview = true;
  }
  return delay(report, 250);
}

// ---- Admin (reactive only — no approvals) ----------------------------------

function assertAdmin(): void {
  const me = findUser(db.currentUserId);
  if (me?.role !== 'admin') throw new Error('Admins only.');
}

export interface AdminReport extends Report {
  reporter?: User;
  targetUser?: User;
  targetEvent?: EnrichedEvent;
  thread?: ChatThread | null;
}

export async function listReports(): Promise<AdminReport[]> {
  assertAdmin();
  const out: AdminReport[] = db.reports
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({
      ...r,
      reporter: findUser(r.reporterId),
      targetUser: r.targetType === 'user' ? findUser(r.targetId) : undefined,
      targetEvent: r.targetType === 'activity' && findEvent(r.targetId) ? enrich(findEvent(r.targetId)!) : undefined,
      thread: r.chatThreadId ? db.threads.find((t) => t.id === r.chatThreadId) ?? null : null,
    }));
  return delay(out, 280);
}

export interface FlaggedUser {
  user: User;
  reportCount: number;
}

export async function listFlaggedUsers(): Promise<FlaggedUser[]> {
  assertAdmin();
  const out = db.users
    .filter((u) => isFlagged(u))
    .map((u) => ({ user: u, reportCount: reportCountForUser(u.id) }))
    .sort((a, b) => a.user.trustScore - b.user.trustScore);
  return delay(out, 280);
}

export async function adminOverview(): Promise<{ openReports: number; flaggedUsers: number; liveToday: number }> {
  assertAdmin();
  const liveToday = db.events.filter(
    (e) => e.lifecycle === 'live' && e.status !== 'PAST' && isToday(new Date(e.startsAt)),
  ).length;
  return delay(
    {
      openReports: db.reports.filter((r) => r.status === 'open').length,
      flaggedUsers: db.users.filter((u) => isFlagged(u)).length,
      liveToday,
    },
    200,
  );
}

export async function listSubscribers(): Promise<unknown[]> {
  assertAdmin();
  return delay(
    db.users
      .filter((u) => u.subscriptionPlan && u.subscriptionPlan !== 'free')
      .map((user) => ({ user, plan: user.subscriptionPlan, status: user.subscriptionStatus ?? 'active' })),
    180,
  );
}

export async function listBusinessesAdmin(): Promise<unknown[]> {
  assertAdmin();
  return delay(MOCK_SPONSORED_VENUES.map((venue) => ({ ...venue, status: 'approved' })), 180);
}

export async function approveBusiness(_id: string): Promise<void> {
  assertAdmin();
  return delay(undefined, 120);
}

export async function listExpressPaymentsAdmin(): Promise<unknown[]> {
  assertAdmin();
  return delay(
    db.events
      .filter((event) => event.priorityLevel === 'express' || event.priorityLevel === 'priority')
      .map((event) => ({ id: event.id, title: event.title, priorityLevel: event.priorityLevel, createdAt: event.startsAt })),
    180,
  );
}

export async function resolveReport(id: string): Promise<void> {
  assertAdmin();
  const r = db.reports.find((x) => x.id === id);
  if (r) r.status = 'resolved';
  return delay(undefined, 150);
}

export async function listUnderReviewActivities(): Promise<EnrichedEvent[]> {
  assertAdmin();
  return delay(
    db.events.filter((e) => e.underReview).map((e) => enrich(e)),
    150,
  );
}

export async function restoreActivity(id: string): Promise<{ success: true }> {
  assertAdmin();
  const e = findEvent(id);
  if (e) e.underReview = false;
  return delay({ success: true }, 150);
}

export async function listPendingActivities(): Promise<EnrichedEvent[]> {
  assertAdmin();
  return delay(
    db.events.filter((e) => !e.approvedAt && e.lifecycle !== 'cancelled').map((e) => enrich(e)),
    150,
  );
}

export async function approveActivity(id: string): Promise<{ success: true }> {
  assertAdmin();
  const e = findEvent(id);
  if (e) e.approvedAt = new Date().toISOString();
  return delay({ success: true }, 150);
}

export async function rejectActivity(id: string): Promise<{ success: true }> {
  assertAdmin();
  const e = findEvent(id);
  if (e) {
    e.lifecycle = 'cancelled';
    e.status = 'PAST';
  }
  return delay({ success: true }, 150);
}

async function moderate(userId: string, mutate: (u: User) => void, ms = 200): Promise<User> {
  assertAdmin();
  const u = findUser(userId);
  if (!u) throw new Error('User not found.');
  mutate(u);
  return delay(u, ms);
}

export async function warnUser(userId: string): Promise<User> {
  return moderate(userId, (u) => {
    pushNotificationTo(u.id, {
      type: 'admin',
      title: 'A note from the Jmaâ team',
      body: 'You’ve received a warning following a report. Please review our community guidelines.',
    });
  });
}

export async function suspendUser(userId: string, days = 7): Promise<User> {
  return moderate(userId, (u) => {
    u.status = 'suspended';
    u.suspendedUntil = new Date(Date.now() + days * 86_400_000).toISOString();
  });
}

export async function banUser(userId: string): Promise<User> {
  return moderate(userId, (u) => {
    u.status = 'banned';
  });
}

// Admin notifications are stored on the global feed but tagged to a user via fromUserId.
function pushNotificationTo(userId: string, n: Omit<AppNotification, 'id' | 'createdAt' | 'read' | 'fromUserId'>) {
  pushNotification({ ...n, fromUserId: userId });
}

// ---- Dev-only lifecycle trigger (testable without waiting) ------------------

export type DevPhase = 'reminders' | 'startMine' | 'endMine';

/**
 * Simulate time-based lifecycle events so the reminder / start / rating flows
 * can be exercised on demand. Surfaced through the existing notifications.
 */
export async function devTriggerLifecycle(phase: DevPhase): Promise<string> {
  const me = db.currentUserId;
  if (phase === 'reminders') {
    const mine = db.events.filter(
      (e) => e.status !== 'PAST' && e.attendees.some((a) => a.userId === me),
    );
    mine.slice(0, 3).forEach((e) =>
      pushNotification({
        type: 'reminder',
        title: 'Your meetup is coming up',
        body: `“${e.title}” — see who’s going and say hi in the group chat.`,
        eventId: e.id,
      }),
    );
    return delay(`Sent ${Math.min(3, mine.length)} reminder(s).`, 200);
  }
  if (phase === 'startMine') {
    const ev = db.events.find((e) => e.hostId === me && e.status !== 'PAST');
    if (!ev) return delay('You have no upcoming hosted activity.', 200);
    // Fast-forward its start to now-ish so "Start activity" is enabled.
    ev.startsAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    ev.endsAt = endsAtOf(ev);
    recomputeStatus(ev);
    return delay(`“${ev.title}” now starts in 10 min — open it and tap Start activity.`, 200);
  }
  // endMine — push a hosted event into the past and prompt ratings.
  const ev = db.events.find((e) => e.hostId === me) ?? db.events.find((e) => e.attendees.some((a) => a.userId === me));
  if (!ev) return delay('No activity to complete.', 200);
  ev.startsAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  ev.endsAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  ev.lifecycle = 'completed';
  recomputeStatus(ev);
  pushNotification({
    type: 'rate',
    title: 'How was it?',
    body: `Rate the people you met at “${ev.title}”.`,
    eventId: ev.id,
    ratePrompt: true,
  });
  return delay(`“${ev.title}” marked complete — check notifications to rate.`, 200);
}
