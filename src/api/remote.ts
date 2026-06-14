// ---------------------------------------------------------------------------
// Live-backend implementations of the api surface, mirroring the signatures in
// `src/api/index.ts`. Activated by setting VITE_API_URL (see http.ts / README).
//
// To switch the app to the live API, either:
//   • set VITE_API_URL and import from '@/api/remote' instead of '@/api', or
//   • re-export selected functions from index.ts guarded by USE_REMOTE.
//
// Response shapes already match the frontend TS types (the NestJS serializers
// were written to the same contract), so components need no changes.
// ---------------------------------------------------------------------------
import { api, tokens } from './http';
import type {
  Activity,
  AppNotification,
  ChatMessage,
  ChatThread,
  CreateActivityInput,
  CreateEventInput,
  EnrichedEvent,
  EventFilters,
  LoginInput,
  MyBusiness,
  Rating,
  RatingInput,
  ReportInput,
  SponsoredVenue,
  User,
} from '@/types';

// ---- Auth ------------------------------------------------------------------
interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export async function login(creds: LoginInput): Promise<User> {
  const res = await api.post<AuthResponse>('/auth/login', creds);
  tokens.set(res);
  return res.user;
}

export async function signup(input: {
  name: string;
  email: string;
  password?: string;
  birthday?: string;
  neighborhood?: string;
  zip?: string;
  phone?: string;
  gender?: string;
  lookingFor?: string;
  turnstileToken?: string;
  /** base64 data URL captured from the file picker; uploaded as `photo`. */
  avatar?: string;
}): Promise<User> {
  // The backend's /auth/signup is multipart: JSON fields + an optional `photo`
  // file. Build a FormData so the avatar actually reaches the server.
  const form = new FormData();
  form.set('name', input.name);
  form.set('email', input.email);
  if (input.password) form.set('password', input.password);
  if (input.birthday) form.set('birthday', input.birthday);
  if (input.neighborhood) form.set('neighborhood', input.neighborhood);
  if (input.zip) form.set('zip', input.zip);
  if (input.phone) form.set('phone', input.phone);
  if (input.gender) form.set('gender', input.gender);
  if (input.lookingFor) form.set('lookingFor', input.lookingFor);
  if (input.turnstileToken) form.set('turnstileToken', input.turnstileToken);
  if (input.avatar) {
    const blob = await fetch(input.avatar).then((r) => r.blob());
    form.set('photo', blob, 'avatar.jpg');
  }
  const res = await api.upload<AuthResponse>('/auth/signup', form);
  tokens.set(res);
  return res.user;
}

export function getCurrentUser(): Promise<User> {
  return api.get<User>('/auth/me');
}

export function updateProfile(patch: Partial<User>): Promise<User> {
  return api.patch<User>('/users/me', patch);
}

export function getUser(id: string): Promise<User | null> {
  return api.get<User>(`/users/${id}`).catch(() => null);
}

// ---- Activity types --------------------------------------------------------
export function listActivities(): Promise<Activity[]> {
  return api.get<Activity[]>('/activity-types');
}

export function createCustomActivity(input: CreateActivityInput): Promise<Activity> {
  return api.post<Activity>('/activity-types', input);
}

// ---- Events ----------------------------------------------------------------
function eventQuery(filters: EventFilters): string {
  const p = new URLSearchParams();
  if (filters.city) p.set('city', filters.city);
  if (filters.activityId) p.set('typeId', filters.activityId);
  if (filters.group) p.set('category', filters.group);
  if (filters.vibe) p.set('vibe', filters.vibe);
  if (filters.skillLevel) p.set('skillLevel', filters.skillLevel);
  if (filters.openSpotsOnly) p.set('openOnly', 'true');
  if (filters.travelersOnly) p.set('travelersWelcome', 'true');
  if (filters.search) p.set('search', filters.search);
  if (filters.date && filters.date !== 'any') p.set('when', filters.date === 'week' ? 'all' : filters.date);
  p.set('limit', '50');
  return p.toString();
}

export async function listEvents(filters: EventFilters = {}): Promise<EnrichedEvent[]> {
  const res = await api.get<{ items: EnrichedEvent[] }>(`/events?${eventQuery(filters)}`);
  return res.items;
}

export async function listPreviewEvents(limit = 4): Promise<EnrichedEvent[]> {
  const res = await api.get<{ items: EnrichedEvent[] }>(`/events?limit=${limit}`);
  return res.items;
}

export function getEvent(id: string): Promise<EnrichedEvent | null> {
  return api.get<EnrichedEvent>(`/events/${id}`).catch(() => null);
}

export function createEvent(input: CreateEventInput & { lat?: number; lng?: number; address?: string }): Promise<EnrichedEvent> {
  // The frontend's CreateEventInput uses spotId/location; the backend wants
  // explicit lat/lng/address/locationLabel.
  const loc = input.location ?? { lat: input.lat ?? 0, lng: input.lng ?? 0, label: 'Meeting point' };
  return api.post<EnrichedEvent>('/events', {
    activityId: input.activityId,
    title: input.title,
    description: input.description,
    locationLabel: loc.label,
    address: (input as { address?: string }).address ?? loc.label,
    areaLabel: input.areaLabel,
    lat: loc.lat,
    lng: loc.lng,
    isPublicPlace: input.publicPlaceConfirmed ?? true,
    startsAt: input.startsAt,
    endsAt: new Date(new Date(input.startsAt).getTime() + input.durationMins * 60000).toISOString(),
    maxAttendees: input.capacity,
    minPlayers: input.minPlayers,
    skillLevel: input.skillLevel,
    price: input.price,
    travelersWelcome: input.travelersWelcome,
    genderPreference: input.genderPreference,
    visibility: input.visibility,
    priorityLevel: input.priorityLevel,
    expressPaymentIntentId: input.expressPaymentIntentId,
    businessId: input.businessId,
  });
}

// ---- Monetization ----------------------------------------------------------
export const getSubscriptionSummary = () =>
  api.get<{ remaining: number | 'unlimited'; plan: string; status: string; resetsAt?: string }>('/subscriptions/me');

export const createSubscriptionCheckout = (planType: 'pro' | 'premium') =>
  api.post<{ url: string }>('/subscriptions/checkout', { planType });

export const createPremiumUserCheckout = () =>
  api.post<{ url: string }>('/subscriptions/premium-checkout', { planType: 'attendee' });

export const createExpressPaymentIntent = (priorityLevel: 'express' | 'priority') =>
  api.post<{ clientSecret: string; amountCents: number }>('/payments/express-intent', { priorityLevel });

export const listSponsoredVenues = () => api.get<SponsoredVenue[]>('/businesses/sponsored-venues');

export const registerBusiness = (input: {
  name: string;
  description?: string;
  address: string;
  lat?: number;
  lng?: number;
  contactEmail: string;
  phone?: string;
}) => api.post('/businesses/register', input);

export const createSponsorshipCheckout = (businessId: string, tier: 'bronze' | 'silver' | 'gold') =>
  api.post<{ url: string }>(`/businesses/${businessId}/sponsorship-checkout`, { tier });

export const getMyBusiness = () => api.get<MyBusiness>('/businesses/mine');

export const updateMyBusiness = (patch: { name?: string; description?: string; address?: string; phone?: string }) =>
  api.patch<MyBusiness>('/businesses/mine', patch);

export async function joinEvent(id: string): Promise<EnrichedEvent> {
  const res = await api.post<{ event: EnrichedEvent }>(`/events/${id}/join`);
  return res.event;
}

export function leaveEvent(id: string): Promise<EnrichedEvent> {
  return api.del<EnrichedEvent>(`/events/${id}/join`);
}

export function startActivity(id: string, note: string): Promise<EnrichedEvent> {
  return api.post<EnrichedEvent>(`/events/${id}/start`, { hostSpotNote: note });
}

export function confirmActivity(id: string): Promise<EnrichedEvent> {
  return api.post<EnrichedEvent>(`/events/${id}/confirm`);
}

export function cancelActivity(id: string): Promise<EnrichedEvent> {
  return api.post<EnrichedEvent>(`/events/${id}/cancel`);
}

/**
 * The current user's events, split for the "My Events" / profile screens.
 * Prefers the dedicated `/events/mine` endpoint (includes past events); if the
 * backend doesn't expose it yet, derives going/hosting from the live feed so
 * those tabs still work (past is unavailable that way and comes back empty).
 * The `userId` arg only exists for mock-signature parity — the backend keys off
 * the JWT, which is always the logged-in user.
 */
export async function getEventsForUser(
  _userId: string,
): Promise<{ hosting: EnrichedEvent[]; going: EnrichedEvent[]; past: EnrichedEvent[] }> {
  const byDateAsc = (a: EnrichedEvent, b: EnrichedEvent) =>
    new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  try {
    return await api.get<{ hosting: EnrichedEvent[]; going: EnrichedEvent[]; past: EnrichedEvent[] }>(
      '/events/mine',
    );
  } catch {
    const all = await listEvents();
    return {
      hosting: all.filter((e) => e.viewerStatus === 'host').sort(byDateAsc),
      going: all
        .filter((e) => e.viewerStatus === 'joined' || e.viewerStatus === 'waitlisted')
        .sort(byDateAsc),
      past: [],
    };
  }
}

// ---- Chat ------------------------------------------------------------------
export function getThread(eventId: string): Promise<ChatThread | null> {
  return api.get<ChatThread>(`/events/${eventId}/chat`).catch(() => null);
}

export function sendMessage(eventId: string, text: string): Promise<ChatMessage> {
  return api.post<ChatMessage>(`/events/${eventId}/chat/messages`, { text });
}

export async function listThreads(_userId: string | undefined): Promise<ChatThread[]> {
  try {
    // Reuse getEventsForUser, which prefers /events/mine but falls back to the
    // public feed (filtered by viewer status) if that endpoint is unavailable —
    // so the chat list works even against an older backend build.
    const mine = await getEventsForUser(_userId ?? '');
    // Every event the user hosts or joined has a group chat (created with the
    // event). Build a thread row per event so the list always reflects the
    // user's memberships, then enrich with real messages when the chat loads.
    // Crucially we never drop an event: a chat with no messages yet (or one the
    // fetch fails for) still shows up as an empty conversation.
    const all = [...mine.hosting, ...mine.going];
    const settled = await Promise.all(
      all.map(async (e) => {
        const stub: ChatThread = {
          id: e.id,
          eventId: e.id,
          title: e.title,
          participantIds: [],
          messages: [],
        };
        const th = await getThread(e.id);
        return th ? ({ ...th, id: e.id, eventId: e.id, title: e.title ?? th.title } as ChatThread) : stub;
      }),
    );
    return settled;
  } catch {
    return [];
  }
}

// ---- Ratings & reports -----------------------------------------------------
export function submitRating(input: RatingInput): Promise<Rating> {
  return api.post<Rating>(`/events/${input.activityId}/ratings`, { toUserId: input.toUserId, score: input.score });
}

export function getRateablePeople(eventId: string): Promise<{ user: User; type: Rating['type'] }[]> {
  return api.get(`/events/${eventId}/ratings/pending`);
}

export function reportTarget(input: ReportInput): Promise<unknown> {
  return api.post('/reports', input);
}

// ---- Notifications ---------------------------------------------------------
export function listNotifications(): Promise<AppNotification[]> {
  return api.get<AppNotification[]>('/users/me/notifications');
}

export function markNotificationsRead(): Promise<void> {
  return api.patch<void>('/users/me/notifications/read-all');
}

// ---- Admin -----------------------------------------------------------------
export const adminOverview = () => api.get('/admin/overview');
export const listReports = () => api.get('/admin/reports');
export const listFlaggedUsers = () => api.get('/admin/flagged-users');
export const listSubscribers = () => api.get('/admin/subscribers');
export const listBusinessesAdmin = () => api.get('/admin/businesses');
export const approveBusiness = (id: string) => api.post(`/admin/businesses/${id}/approve`);
export const listExpressPaymentsAdmin = () => api.get('/admin/express-payments');
export const listUnderReviewActivities = () => api.get<EnrichedEvent[]>('/admin/under-review');
export const restoreActivity = (id: string) => api.post(`/admin/activities/${id}/restore`);
export const listPendingActivities = () => api.get<EnrichedEvent[]>('/admin/pending-activities');
export const approveActivity = (id: string) => api.post(`/admin/activities/${id}/approve`);
export const rejectActivity = (id: string) => api.post(`/admin/activities/${id}/reject`);
export const resolveReport = (id: string) => api.patch(`/admin/reports/${id}/resolve`);
export const warnUser = (id: string) => api.post(`/admin/users/${id}/warn`);
export const suspendUser = (id: string, days = 7) => api.post(`/admin/users/${id}/suspend`, { days });
export const banUser = (id: string) => api.post(`/admin/users/${id}/ban`);
