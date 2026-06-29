import type {
  Activity,
  AdminBusinessVerification,
  AdminVenueClaim,
  AppNotification,
  BusinessOrg,
  ChatMessage,
  ChatThread,
  Conditions,
  CreateActivityInput,
  CreateEventInput,
  EnrichedEvent,
  EventFilters,
  CheckoutSession,
  JmaaEvent,
  LoginInput,
  MyBusiness,
  Rating,
  RatingInput,
  ReferralSummary,
  Report,
  ReportInput,
  Review,
  SignupInput,
  Spot,
  SponsoredVenue,
  SponsorshipTier,
  User,
  VenueCard,
  VenueProfile,
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

export async function signupBusiness(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<User> {
  const me = findUser(db.currentUserId)!;
  me.name = input.name;
  if (input.phone !== undefined) me.phone = input.phone;
  me.role = 'business';
  me.status = 'active';
  // Flag this account as a business so the app switches to the business UI.
  me.businessId = me.businessId ?? nextId('biz-');
  return delay(me, 500);
}

export async function getCurrentUser(): Promise<User> {
  const me = findUser(db.currentUserId)!;
  refreshSuspension(me);
  return delay(me, 120);
}

export async function getReferral(): Promise<ReferralSummary> {
  const code = 'DEMO123';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return delay({ code, link: `${origin}/signup?ref=${code}`, joinedCount: 0, rewardDays: 7 }, 120);
}

export async function updateProfile(patch: Partial<User>): Promise<User> {
  const me = findUser(db.currentUserId)!;
  Object.assign(me, patch);
  return delay(me, 250);
}

export async function submitVerification(selfie: File, pose: string): Promise<User> {
  const me = findUser(db.currentUserId)!;
  me.verificationStatus = 'pending';
  me.verificationSelfieUrl = URL.createObjectURL(selfie);
  me.verificationPose = pose;
  pushNotification({ type: 'admin', title: 'New verification to review', body: 'A user submitted an identity selfie for verification.' });
  saveDb();
  return delay(me, 300);
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
  // Online activities have no physical city — show them under any city filter.
  if (!e.isOnline) {
    if (f.city && enriched.resolvedLocation && enriched.spot?.city && enriched.spot.city !== f.city)
      return false;
    if (f.city && enriched.host.city && !enriched.spot && enriched.host.city !== f.city) return false;
  }
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

  // "Near me": viewer coordinates from the filters take priority over a ZIP origin.
  const origin =
    filters.lat != null && filters.lng != null ? { lat: filters.lat, lng: filters.lng } : cityOriginForZip(opts.zip);
  const sortByDistance = filters.sort === 'distance' || opts.sort === 'distance';
  // Featured ordering (mirrors the backend): sponsored venues (Gold › Silver › Bronze)
  // → pinned host-tier activities → everyone else, with a half-step boost for verified
  // hosts so they outrank unverified hosts at the same tier. Distance/date is the
  // tiebreaker within each rank.
  const tierRank: Record<string, number> = { gold: 3, silver: 2, bronze: 1 };
  const rankOf = (e: EnrichedEvent): number => {
    const pinned = !!e.pinnedUntil && new Date(e.pinnedUntil).getTime() > Date.now();
    let r = e.sponsoredVenue ? 10 + (tierRank[e.sponsoredVenue.tier] ?? 0) : pinned ? 2 : 0;
    if (e.host?.verified) r += 0.5;
    return r;
  };
  const tiebreak =
    sortByDistance && origin
      ? (a: EnrichedEvent, b: EnrichedEvent) =>
          distanceKm(origin, a.resolvedLocation) - distanceKm(origin, b.resolvedLocation)
      : (a: EnrichedEvent, b: EnrichedEvent) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  list = list.sort((a, b) => rankOf(b) - rankOf(a) || tiebreak(a, b));
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

// Host membership tiers — windows, weekly pin quotas and prices mirror the backend.
// Free 1/3d · Bronze 1/2d · Silver 1/day · Gold unlimited.
const HOSTING_WINDOW_MS: Record<string, number | null> = {
  free: 1 * 86_400_000,
  pro: null,
  // legacy host tiers
  bronze: 2 * 86_400_000,
  silver: 1 * 86_400_000,
  gold: null,
};
const PIN_QUOTA: Record<string, number> = { free: 0, pro: 7, bronze: 1, silver: 3, gold: Infinity };
const HOST_PRICE_CENTS: Record<string, number> = { free: 0, pro: 4900, bronze: 2990, silver: 5990, gold: 9990 };
const PIN_WINDOW_MS = 7 * 86_400_000;

function planOf(userId: string): string {
  return findUser(userId)?.subscriptionPlan ?? 'free';
}

/**
 * Activities a host created within their plan's hosting window. Counts by
 * creation time (falling back to startsAt for older seed records). Gold = 0
 * (unlimited, so it never counts toward a limit).
 */
function activitiesHostedThisWindow(userId: string): number {
  const windowMs = HOSTING_WINDOW_MS[planOf(userId)] ?? null;
  if (windowMs === null) return 0;
  const windowAgo = Date.now() - windowMs;
  return db.events.filter(
    (event) => event.hostId === userId && new Date(event.createdAt ?? event.startsAt).getTime() >= windowAgo,
  ).length;
}

/** When the host's next free activity unlocks (most recent in-window + window). */
function freeActivityResetsAt(userId: string): string | undefined {
  const windowMs = HOSTING_WINDOW_MS[planOf(userId)] ?? null;
  if (windowMs === null) return undefined;
  const windowAgo = Date.now() - windowMs;
  const inWindow = db.events
    .filter((event) => event.hostId === userId && new Date(event.createdAt ?? event.startsAt).getTime() >= windowAgo)
    .map((event) => new Date(event.createdAt ?? event.startsAt).getTime());
  if (!inWindow.length) return undefined;
  return new Date(Math.max(...inWindow) + windowMs).toISOString();
}

/** Whether the host has a weekly auto-pin left under their tier quota. */
function hasPinAllowance(userId: string): boolean {
  const quota = PIN_QUOTA[planOf(userId)] ?? 0;
  if (quota <= 0) return false;
  if (quota === Infinity) return true;
  const since = Date.now() - PIN_WINDOW_MS;
  const usedPins = db.events.filter(
    (e) => e.hostId === userId && !!e.pinnedUntil && new Date(e.createdAt ?? e.startsAt).getTime() >= since,
  ).length;
  return usedPins < quota;
}

/** Create an activity. Goes LIVE immediately — there is no pending/approval state. */
export async function createEvent(input: CreateEventInput & { lat?: number; lng?: number; address?: string }): Promise<EnrichedEvent> {
  const block = actionBlockReason(db.currentUserId);
  if (block) throw new Error(block);
  const me = findUser(db.currentUserId)!;
  const plan = me.subscriptionPlan ?? 'free';
  const paidExtra = input.priorityLevel === 'express' || input.priorityLevel === 'priority';
  const usedThisWindow = activitiesHostedThisWindow(db.currentUserId);
  // Gold (window null) is unlimited; everyone else gets 1 per their window.
  const mustPay = HOSTING_WINDOW_MS[plan] !== null && usedThisWindow >= 1;
  if (mustPay && !paidExtra) {
    throw new Error('You’ve used your free activity for now. Pay the one-time fee to host another, or upgrade your plan for more.');
  }
  // Pinned: the host's tier auto-pin allowance (Bronze 1/wk, Silver 3/wk, Gold ∞),
  // $2.99 priority extras, and the $0.99 express option on a free activity.
  const pinned =
    hasPinAllowance(db.currentUserId) ||
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
    priorityLevel: input.priorityLevel ?? 'standard',
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
    type: event.approvedAt ? 'confirmed' : 'admin',
    title: event.approvedAt ? 'Your activity is live 🎉' : 'Activity submitted for review',
    body: event.approvedAt
      ? `“${event.title}” is now visible in the feed. Invite people in the group chat!`
      : `“${event.title}” will appear once an admin approves it.`,
    eventId: event.id,
  });
  // Admin alert when an activity needs approval.
  if (!event.approvedAt) {
    pushNotification({ type: 'admin', title: 'Activity needs approval', body: `“${event.title}” is awaiting review.`, eventId: event.id });
  }
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

function pinInfoOf(userId: string): { pinsRemaining: number | 'unlimited'; pinQuota: number | 'unlimited' } {
  const quota = PIN_QUOTA[planOf(userId)] ?? 0;
  if (quota === Infinity) return { pinsRemaining: 'unlimited', pinQuota: 'unlimited' };
  if (quota <= 0) return { pinsRemaining: 0, pinQuota: 0 };
  const since = Date.now() - PIN_WINDOW_MS;
  const usedPins = db.events.filter(
    (e) => e.hostId === userId && !!e.pinnedUntil && new Date(e.createdAt ?? e.startsAt).getTime() >= since,
  ).length;
  return { pinsRemaining: Math.max(0, quota - usedPins), pinQuota: quota };
}

export async function getSubscriptionSummary(): Promise<{
  remaining: number | 'unlimited';
  plan: string;
  status: string;
  resetsAt?: string;
  pinsRemaining: number | 'unlimited';
  pinQuota: number | 'unlimited';
}> {
  const me = findUser(db.currentUserId)!;
  const plan = me.subscriptionPlan ?? 'free';
  const status = me.subscriptionStatus ?? (plan === 'free' ? 'inactive' : 'active');
  const pins = pinInfoOf(db.currentUserId);
  if (HOSTING_WINDOW_MS[plan] === null) return delay({ remaining: 'unlimited', plan, status, ...pins }, 120);
  const used = activitiesHostedThisWindow(db.currentUserId);
  const remaining = Math.max(0, 1 - used);
  return delay(
    { remaining, plan, status, resetsAt: remaining === 0 ? freeActivityResetsAt(db.currentUserId) : undefined, ...pins },
    120,
  );
}

// The mock has no Paddle, so every checkout is a simulation: the effect is
// applied at checkout-create time and the returned session is marked `simulated`
// (settleCheckout then resolves without opening an overlay). `ref` is the order
// id an extra-activity purchase carries back to createEvent.
function simulatedSession(amountCents: number): CheckoutSession {
  return { ref: nextId('ord-'), amountCents, simulated: true };
}

export async function createSubscriptionCheckout(planType: 'pro'): Promise<CheckoutSession> {
  const me = findUser(db.currentUserId)!;
  me.subscriptionPlan = planType;
  me.subscriptionStatus = 'active';
  saveDb();
  return delay(simulatedSession(4900), 200);
}

export async function createExpressPaymentIntent(priorityLevel: 'express' | 'priority'): Promise<CheckoutSession> {
  return delay(simulatedSession(priorityLevel === 'express' ? 990 : 1990), 180);
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
  pushNotification({ type: 'admin', title: 'New business registered', body: `“${input.name}” registered and is awaiting approval.` });
  return delay({ id: nextId('biz-'), ...input }, 250);
}

const SPONSOR_MONTHLY_MAD: Record<SponsorshipTier, number> = { starter: 199, bronze: 490, silver: 990, gold: 1990 };
const INTERVAL_MONTHS: Record<'monthly' | 'quarterly' | 'annual', number> = { monthly: 1, quarterly: 3, annual: 12 };
const INTERVAL_DISCOUNT: Record<'monthly' | 'quarterly' | 'annual', number> = { monthly: 0, quarterly: 0.1, annual: 0.15 };

export async function createSponsorshipCheckout(
  _businessId: string,
  tier: SponsorshipTier,
  interval: 'monthly' | 'quarterly' | 'annual' = 'monthly',
): Promise<CheckoutSession> {
  const amountMad = Math.round(SPONSOR_MONTHLY_MAD[tier] * INTERVAL_MONTHS[interval] * (1 - INTERVAL_DISCOUNT[interval]));
  return delay(simulatedSession(amountMad * 100), 220);
}

let MOCK_BUSINESS: MyBusiness = {
  business: {
    id: 'biz-mock',
    name: 'Café Atlas',
    description: 'Cozy café & boardgame corner in Gauthier.',
    address: 'Gauthier, Casablanca',
    phone: '+212 600-000000',
    contactEmail: 'hello@cafeatlas.ma',
    status: 'verified',
    photos: [],
  },
  sponsorship: {
    tier: 'silver',
    status: 'active',
    used: 4,
    limit: 15,
    remaining: 11,
    startDate: new Date(Date.now() - 12 * 86_400_000).toISOString(),
    monthlyPriceCents: 99000,
  },
  activities: [
    { id: 'e2', title: 'Sunday boardgames', activityType: 'Board games', hostName: 'Lena', startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(), endsAt: new Date(Date.now() + 2 * 86_400_000 + 2 * 3_600_000).toISOString(), going: 6, capacity: 10, price: 0, status: 'live', locationLabel: 'Café Atlas', couponCode: 'HUDLGO-ATLAS1' },
    { id: 'e3', title: 'Coffee & code', activityType: 'Coffee', hostName: 'Omar', startsAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), endsAt: new Date(Date.now() - 3 * 86_400_000 + 90 * 60_000).toISOString(), going: 4, capacity: 8, price: 30, status: 'completed', locationLabel: 'Café Atlas', couponCode: 'HUDLGO-ATLAS2' },
  ],
};

export async function getMyBusiness(): Promise<MyBusiness> {
  return delay(MOCK_BUSINESS, 200);
}

export async function updateMyBusiness(patch: { name?: string; description?: string; address?: string; phone?: string }): Promise<MyBusiness> {
  MOCK_BUSINESS = { ...MOCK_BUSINESS, business: { ...MOCK_BUSINESS.business, ...patch } };
  return delay(MOCK_BUSINESS, 250);
}

export async function uploadVenuePhotos(files: File[]): Promise<MyBusiness> {
  const room = Math.max(0, 6 - MOCK_BUSINESS.business.photos.length);
  const urls = files.slice(0, room).map((f) => URL.createObjectURL(f));
  MOCK_BUSINESS = { ...MOCK_BUSINESS, business: { ...MOCK_BUSINESS.business, photos: [...MOCK_BUSINESS.business.photos, ...urls] } };
  return delay(MOCK_BUSINESS, 300);
}

export async function removeVenuePhoto(url: string): Promise<MyBusiness> {
  MOCK_BUSINESS = {
    ...MOCK_BUSINESS,
    business: { ...MOCK_BUSINESS.business, photos: MOCK_BUSINESS.business.photos.filter((p) => p !== url) },
  };
  return delay(MOCK_BUSINESS, 200);
}

// ---- Business orgs & venues (Foundation, in-memory) ------------------------
let MOCK_ORGS: BusinessOrg[] = [
  {
    id: 'org-anfa', name: 'Anfa Padel Club', category: 'sports_venue', legalName: 'Anfa Padel Club SARL',
    description: 'Indoor and outdoor padel courts, café and pro shop.', address: 'Bd de l’Océan Atlantique, Anfa, Casablanca',
    lat: 33.59, lng: -7.63, contactEmail: 'venue@jmaa.app', phone: '+212 522 000 000', website: 'https://anfapadel.example',
    logoUrl: null, coverUrl: null, status: 'verified', verified: true, role: 'owner',
  },
];

let MOCK_VENUES: VenueProfile[] = [
  {
    id: 'venue-anfa', businessId: 'org-anfa', name: 'Padel Club Anfa', slug: 'padel-club-anfa', category: 'sports_venue',
    address: 'Bd de l’Océan Atlantique, Anfa, Casablanca', lat: 33.59, lng: -7.63, photos: [], status: 'verified',
    avgRating: 5, reviewCount: 1, description: 'Six glass courts, floodlit, café overlooking the Atlantic.',
    amenities: ['Parking', 'Café', 'Showers'], hours: { mon: '08:00–23:00' }, phone: '+212 522 000 000', website: 'https://anfapadel.example',
    business: { id: 'org-anfa', name: 'Anfa Padel Club', verified: true, logoUrl: null },
    upcomingEvents: [], reviews: [{ id: 'vr1', rating: 5, text: 'Great courts and a friendly crowd.', authorName: 'Karim Tazi', authorPhoto: null, createdAt: new Date().toISOString() }],
  },
  {
    id: 'venue-boardwalk', businessId: null, name: 'Boardwalk Café', slug: 'boardwalk-cafe-rabat', category: 'cafe',
    address: 'Av. Fal Ould Oumeir, Agdal, Rabat', lat: 34.0, lng: -6.84, photos: [], status: 'listed',
    avgRating: 0, reviewCount: 0, description: '', amenities: [], hours: {}, phone: null, website: null,
    business: null, upcomingEvents: [], reviews: [],
  },
];

const orgCard = (v: VenueProfile): VenueCard => ({ id: v.id, businessId: v.businessId, name: v.name, slug: v.slug, category: v.category, address: v.address, lat: v.lat, lng: v.lng, photos: v.photos, status: v.status, avgRating: v.avgRating, reviewCount: v.reviewCount });

export async function createBusinessOrg(input: { name: string; category: string; legalName?: string; description?: string; address: string; lat?: number; lng?: number; contactEmail: string; phone?: string; website?: string; acceptBusinessTos: boolean }): Promise<BusinessOrg> {
  if (!input.acceptBusinessTos) throw new Error('You must accept the business terms of service.');
  const org: BusinessOrg = {
    id: nextId('org-'), name: input.name, category: input.category, legalName: input.legalName,
    description: input.description ?? '', address: input.address, lat: input.lat, lng: input.lng,
    contactEmail: input.contactEmail, phone: input.phone ?? '', website: input.website,
    logoUrl: null, coverUrl: null, status: 'pending_verification', verified: false, role: 'owner',
  };
  MOCK_ORGS = [...MOCK_ORGS, org];
  pushNotification({ type: 'admin', title: 'New business registered', body: `“${org.name}” registered and is awaiting verification.` });
  return delay(org, 250);
}

export async function getMyBusinesses(): Promise<BusinessOrg[]> {
  return delay(MOCK_ORGS, 150);
}

export async function getBusinessOrg(id: string): Promise<{ id: string; name: string; category: string; description: string; logoUrl: string | null; coverUrl: string | null; website: string | null; verified: boolean; venues: VenueCard[] }> {
  const org = MOCK_ORGS.find((o) => o.id === id);
  if (!org) throw new Error('Business not found.');
  return delay({ id: org.id, name: org.name, category: org.category, description: org.description, logoUrl: org.logoUrl, coverUrl: org.coverUrl, website: org.website ?? null, verified: org.verified, venues: MOCK_VENUES.filter((v) => v.businessId === id).map(orgCard) }, 150);
}

export async function updateBusinessOrg(id: string, patch: Partial<BusinessOrg>): Promise<BusinessOrg> {
  MOCK_ORGS = MOCK_ORGS.map((o) => (o.id === id ? { ...o, ...patch } : o));
  return delay(MOCK_ORGS.find((o) => o.id === id)!, 200);
}

export async function submitBusinessVerification(_id: string, input: { rcNumber?: string; iceNumber?: string; documents?: File[]; documentUrls?: string[] }): Promise<{ id: string; status: string; documentCount: number }> {
  pushNotification({ type: 'admin', title: 'Business verification submitted', body: 'A business submitted documents for verification review.' });
  return delay({ id: nextId('bv-'), status: 'pending', documentCount: (input.documents?.length ?? 0) + (input.documentUrls?.length ?? 0) }, 250);
}

export async function inviteBusinessMember(_id: string, _email: string, _role: 'MANAGER' | 'STAFF'): Promise<{ success: true }> { return delay({ success: true }, 200); }
export async function acceptBusinessInvite(_businessId: string): Promise<{ success: true }> { return delay({ success: true }, 200); }
export async function updateBusinessMemberRole(_id: string, _userId: string, _role: 'MANAGER' | 'STAFF'): Promise<{ success: true }> { return delay({ success: true }, 200); }
export async function removeBusinessMember(_id: string, _userId: string): Promise<{ success: true }> { return delay({ success: true }, 200); }

export async function listVenues(filters: { category?: string; q?: string; lat?: number; lng?: number; radiusKm?: number } = {}): Promise<VenueCard[]> {
  let list = MOCK_VENUES;
  if (filters.category) list = list.filter((v) => v.category === filters.category);
  if (filters.q) list = list.filter((v) => v.name.toLowerCase().includes(filters.q!.toLowerCase()));
  return delay(list.map(orgCard), 150);
}

export async function getVenue(id: string): Promise<VenueProfile> {
  const v = MOCK_VENUES.find((x) => x.id === id || x.slug === id);
  if (!v) throw new Error('Venue not found.');
  return delay(v, 150);
}

export async function createVenue(input: { businessId: string; name: string; category: string; description?: string; address: string; lat: number; lng: number; amenities?: string[]; hours?: Record<string, string>; phone?: string; website?: string }): Promise<VenueCard> {
  const org = MOCK_ORGS.find((o) => o.id === input.businessId);
  const v: VenueProfile = {
    id: nextId('venue-'), businessId: input.businessId, name: input.name, slug: `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${nextId('')}`,
    category: input.category, address: input.address, lat: input.lat, lng: input.lng, photos: [],
    status: org?.verified ? 'verified' : 'claimed', avgRating: 0, reviewCount: 0, description: input.description ?? '',
    amenities: input.amenities ?? [], hours: input.hours ?? {}, phone: input.phone ?? null, website: input.website ?? null,
    business: org ? { id: org.id, name: org.name, verified: org.verified, logoUrl: org.logoUrl } : null, upcomingEvents: [], reviews: [],
  };
  MOCK_VENUES = [...MOCK_VENUES, v];
  return delay(orgCard(v), 250);
}

export async function updateVenue(id: string, patch: Partial<VenueProfile>): Promise<VenueCard> {
  MOCK_VENUES = MOCK_VENUES.map((v) => (v.id === id ? { ...v, ...patch } : v));
  return delay(orgCard(MOCK_VENUES.find((v) => v.id === id)!), 200);
}

export async function claimVenue(_id: string, _businessId: string, _evidence?: File[]): Promise<{ id: string; status: string }> {
  pushNotification({ type: 'admin', title: 'Venue claim submitted', body: 'A business submitted a venue claim.' });
  return delay({ id: nextId('claim-'), status: 'pending' }, 250);
}

export async function submitVenueReview(id: string, rating: number, text?: string): Promise<{ id: string; rating: number; text: string }> {
  const v = MOCK_VENUES.find((x) => x.id === id);
  if (v) {
    v.reviews = [{ id: nextId('vr-'), rating, text: text ?? '', authorName: findUser(db.currentUserId)?.name ?? 'You', authorPhoto: null, createdAt: new Date().toISOString() }, ...v.reviews];
    v.reviewCount = v.reviews.length;
    v.avgRating = v.reviews.reduce((s, r) => s + r.rating, 0) / v.reviews.length;
  }
  return delay({ id: nextId('vr-'), rating, text: text ?? '' }, 200);
}

// admin
export async function listBusinessVerificationsAdmin(): Promise<AdminBusinessVerification[]> { return delay([], 150); }
export async function approveBusinessVerification(_id: string): Promise<{ success: true }> { return delay({ success: true }, 150); }
export async function rejectBusinessVerification(_id: string, _note?: string): Promise<{ success: true }> { return delay({ success: true }, 150); }
export async function listVenueClaimsAdmin(): Promise<AdminVenueClaim[]> { return delay([], 150); }
export async function approveVenueClaim(_id: string): Promise<{ success: true }> { return delay({ success: true }, 150); }
export async function rejectVenueClaim(_id: string, _note?: string): Promise<{ success: true }> { return delay({ success: true }, 150); }

/** Join checks: account active (not suspended/banned), not already joined. */
export async function joinEvent(id: string, _shareContactWithHostBusiness = false): Promise<EnrichedEvent> {
  const userId = db.currentUserId;
  const block = actionBlockReason(userId);
  if (block) throw new Error(block);
  const e = findEvent(id);
  if (!e) throw new Error('Activity not found.');
  if (e.lifecycle === 'cancelled') throw new Error('This activity was cancelled.');
  joinEventInStore(id, userId);
  // Notify the host that someone joined their activity.
  if (e.hostId !== userId) {
    const joiner = findUser(userId);
    pushNotification({
      type: 'join_request',
      title: 'New attendee 🎉',
      body: `${joiner?.name ?? 'Someone'} joined “${e.title}”.`,
      eventId: id,
    });
  }
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

/** Event end time for a group-chat thread (explicit endsAt, else startsAt + duration). */
function threadEndsAt(t: ChatThread): string | undefined {
  const e = t.eventId ? db.events.find((ev) => ev.id === t.eventId) : undefined;
  if (!e) return undefined;
  return e.endsAt ?? endsAtOf({ startsAt: e.startsAt, durationMins: e.durationMins });
}

/** Attach the activity's start/end + ended flag so the UI can show the date + lock input. */
function enrichThread(t: ChatThread): ChatThread {
  const e = t.eventId ? db.events.find((ev) => ev.id === t.eventId) : undefined;
  if (!e) return t;
  const endsAt = threadEndsAt(t);
  const ended = endsAt ? new Date(endsAt).getTime() < Date.now() : false;
  return { ...t, startsAt: e.startsAt, endsAt, ended };
}

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
  return delay(structuredClone(threads).map(enrichThread), 280);
}

export async function getThread(id: string): Promise<ChatThread | null> {
  const t = db.threads.find((x) => x.id === id);
  return delay(t ? enrichThread(structuredClone(t)) : null, 200);
}

export async function sendMessage(threadId: string, text: string): Promise<ChatMessage> {
  const violation = messageViolation(text);
  if (violation) throw new Error(violation);
  const thread = db.threads.find((t) => t.id === threadId);
  if (thread && threadExpired(thread)) throw new Error('This group chat has closed.');
  // Once the activity has ended, the chat is read-only.
  const endsAt = thread ? threadEndsAt(thread) : undefined;
  if (endsAt && new Date(endsAt).getTime() < Date.now()) {
    throw new Error('This activity has ended — the chat is now read-only.');
  }
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
  // A rating with a written comment becomes a public review on the profile.
  if (input.comment?.trim()) {
    const me = findUser(db.currentUserId);
    db.reviews.unshift({
      id: nextId('rev-'),
      eventId: input.activityId,
      fromUserId: db.currentUserId,
      toUserId: input.toUserId,
      rating: input.score,
      text: input.comment.trim(),
      createdAt: new Date().toISOString(),
      fromName: me?.name,
      fromAvatar: me?.avatar,
    });
    saveDb();
  }
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
  pushNotification({
    type: 'report',
    title: 'New report filed',
    body: `${input.targetType === 'user' ? 'A user' : 'An activity'} was reported.`,
    eventId: input.targetType === 'activity' ? input.targetId : undefined,
  });
  return delay(report, 250);
}

// ---- Feedback --------------------------------------------------------------

export type FeedbackCategory = 'idea' | 'bug' | 'praise' | 'other';

export interface FeedbackInput {
  category: FeedbackCategory;
  message: string;
  path?: string;
}

export interface AdminFeedback {
  id: string;
  category: FeedbackCategory;
  message: string;
  path?: string;
  resolved: boolean;
  createdAt: string;
  user?: { id: string; name: string; avatar?: string; email?: string };
}

const feedbackStore: AdminFeedback[] = [];

export async function submitFeedback(input: FeedbackInput): Promise<{ success: true }> {
  const me = findUser(db.currentUserId);
  feedbackStore.unshift({
    id: `fb_${Date.now()}`,
    category: input.category,
    message: input.message.trim(),
    path: input.path,
    resolved: false,
    createdAt: new Date().toISOString(),
    user: me ? { id: me.id, name: me.name, avatar: me.avatar } : undefined,
  });
  return delay({ success: true }, 220);
}

export async function listFeedback(): Promise<AdminFeedback[]> {
  assertAdmin();
  const out = [...feedbackStore].sort(
    (a, b) => Number(a.resolved) - Number(b.resolved) || b.createdAt.localeCompare(a.createdAt),
  );
  return delay(out, 220);
}

export async function resolveFeedback(id: string): Promise<{ success: true }> {
  assertAdmin();
  const f = feedbackStore.find((x) => x.id === id);
  if (f) f.resolved = true;
  return delay({ success: true }, 150);
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

export interface NamedCount {
  label: string;
  count: number;
}
export interface DailyPoint {
  date: string;
  count: number;
}
export interface AdminAnalytics {
  totals: { users: number; activities: number; liveActivities: number; businesses: number; approvedBusinesses: number; subscribers: number; attendances: number };
  growth: { newUsers7d: number; newUsers30d: number; newActivities7d: number; joins7d: number; messages7d: number };
  engagement: { avgTrust: number; avgAttendeesPerActivity: number; activeHosts: number };
  moderation: { openReports: number; resolvedReports: number; flaggedUsers: number; underReview: number; pendingApproval: number; suspended: number; banned: number };
  monetization: { hostPro: number; paidExtras: number; mrrCents: number; businessTiers: { starter: number; bronze: number; silver: number; gold: number } };
  activityStatus: { live: number; completed: number; cancelled: number };
  topActivities: NamedCount[];
  topCities: NamedCount[];
  signupsByDay: DailyPoint[];
  activitiesByDay: DailyPoint[];
}

function bucketDays(timestamps: (number | undefined)[]): DailyPoint[] {
  const day = 86_400_000;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime() - 13 * day;
  const map = new Map<string, number>();
  for (let i = 0; i < 14; i++) map.set(new Date(startMs + i * day).toISOString().slice(0, 10), 0);
  for (const t of timestamps) {
    if (t == null) continue;
    const k = new Date(t).toISOString().slice(0, 10);
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([date, count]) => ({ date, count }));
}

export async function adminAnalytics(): Promise<AdminAnalytics> {
  assertAdmin();
  const now = Date.now();
  const day = 86_400_000;
  const since7 = now - 7 * day;
  const since30 = now - 30 * day;
  const ts = (d?: string) => (d ? new Date(d).getTime() : undefined);
  const ev = db.events;
  const us = db.users;

  const live = ev.filter((e) => (e.lifecycle ?? 'live') === 'live').length;
  const completed = ev.filter((e) => e.lifecycle === 'completed').length;
  const cancelled = ev.filter((e) => e.lifecycle === 'cancelled').length;
  const attendances = ev.reduce((n, e) => n + e.attendees.length, 0);

  const hostPro = us.filter((u) => u.subscriptionPlan === 'pro').length;
  // Legacy host tiers still counted toward subscriber totals.
  const hostLegacy = us.filter((u) => ['bronze', 'silver', 'gold'].includes(u.subscriptionPlan ?? '')).length;
  const paidExtras = ev.filter((e) => e.expressFeePaid).length;

  const tierOf = (t: SponsorshipTier) => MOCK_SPONSORED_VENUES.filter((v) => v.tier === t).length;
  const starter = tierOf('starter');
  const bronze = tierOf('bronze');
  const silver = tierOf('silver');
  const gold = tierOf('gold');
  const mrrCents =
    hostPro * 4900 + starter * 19900 + bronze * 49000 + silver * 99000 + gold * 199000;

  const activityCounts = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  for (const e of ev) {
    const en = enrich(e);
    activityCounts.set(en.activity.name, (activityCounts.get(en.activity.name) ?? 0) + 1);
    const city = e.areaLabel || en.host.city || 'Other';
    cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
  }
  const topList = (m: Map<string, number>): NamedCount[] =>
    [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8);

  return delay(
    {
      totals: {
        users: us.length,
        activities: ev.length,
        liveActivities: live,
        businesses: MOCK_SPONSORED_VENUES.length,
        approvedBusinesses: MOCK_SPONSORED_VENUES.length,
        subscribers: hostPro + hostLegacy,
        attendances,
      },
      growth: {
        newUsers7d: us.filter((u) => (ts(u.joinedAt) ?? 0) >= since7).length,
        newUsers30d: us.filter((u) => (ts(u.joinedAt) ?? 0) >= since30).length,
        newActivities7d: ev.filter((e) => (ts(e.createdAt) ?? 0) >= since7).length,
        joins7d: ev.reduce((n, e) => n + e.attendees.filter((a) => (ts(a.joinedAt) ?? 0) >= since7).length, 0),
        messages7d: db.threads.reduce((n, t) => n + t.messages.filter((m) => (ts(m.sentAt) ?? 0) >= since7).length, 0),
      },
      engagement: {
        avgTrust: us.length ? us.reduce((s, u) => s + u.trustScore, 0) / us.length : 0,
        avgAttendeesPerActivity: ev.length ? attendances / ev.length : 0,
        activeHosts: new Set(ev.map((e) => e.hostId)).size,
      },
      moderation: {
        openReports: db.reports.filter((r) => r.status === 'open').length,
        resolvedReports: db.reports.filter((r) => r.status === 'resolved').length,
        flaggedUsers: us.filter((u) => isFlagged(u)).length,
        underReview: ev.filter((e) => e.underReview).length,
        pendingApproval: ev.filter((e) => !e.approvedAt && (e.lifecycle ?? 'live') === 'live').length,
        suspended: us.filter((u) => u.status === 'suspended').length,
        banned: us.filter((u) => u.status === 'banned').length,
      },
      monetization: {
        hostPro,
        paidExtras,
        mrrCents,
        businessTiers: { starter, bronze, silver, gold },
      },
      activityStatus: { live, completed, cancelled },
      topActivities: topList(activityCounts),
      topCities: topList(cityCounts),
      signupsByDay: bucketDays(us.map((u) => ts(u.joinedAt))),
      activitiesByDay: bucketDays(ev.map((e) => ts(e.createdAt))),
    },
    220,
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
  return delay(MOCK_SPONSORED_VENUES.map((venue) => ({ ...venue, status: 'verified' })), 180);
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

export interface AdminVerification {
  user: User;
  selfieUrl: string;
  pose?: string;
  submittedAt: string;
}

export async function listVerifications(): Promise<AdminVerification[]> {
  assertAdmin();
  return delay(
    db.users
      .filter((u) => u.verificationStatus === 'pending' && u.verificationSelfieUrl)
      .map((u) => ({ user: u, selfieUrl: u.verificationSelfieUrl!, pose: u.verificationPose, submittedAt: u.joinedAt })),
    150,
  );
}

export async function approveVerification(id: string): Promise<{ success: true }> {
  assertAdmin();
  const u = findUser(id);
  if (u) {
    u.verified = true;
    u.verificationStatus = 'approved';
  }
  saveDb();
  return delay({ success: true }, 150);
}

export async function rejectVerification(id: string): Promise<{ success: true }> {
  assertAdmin();
  const u = findUser(id);
  if (u) {
    u.verified = false;
    u.verificationStatus = 'rejected';
  }
  saveDb();
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
      title: 'A note from the hudlgo team',
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
