// ---------------------------------------------------------------------------
// Shared domain types for Jmaâ.
// These mirror the future REST API shapes — the mock API in src/api returns
// exactly these structures.
// ---------------------------------------------------------------------------

export type SkillLevel = 'any' | 'beginner' | 'intermediate' | 'advanced';

export type ActivityCategory =
  | 'racket'
  | 'water'
  | 'team'
  | 'outdoor'
  | 'fitness'
  | 'wheels'
  | 'mind'
  | 'social'
  | 'other';

/** High-level grouping used for IA, filtering and muted color coding. */
export type ActivityGroup = 'sport' | 'outdoor' | 'social';

/** The feel of an activity: relaxed & social vs. active & competitive. */
export type Vibe = 'chill' | 'active';

/** What a user is on Jmaâ for — drives Discover personalization. */
export type LookingFor = 'partners' | 'friends' | 'both';

export type RsvpStatus = 'going' | 'waitlisted' | 'host';

/** RSVP / capacity status (team-minimum + waitlist machine). */
export type EventStatus = 'PENDING' | 'CONFIRMED' | 'FULL' | 'PAST';

/** Real-world lifecycle of a meetup, independent of the RSVP machine. */
export type EventLifecycle = 'live' | 'completed' | 'cancelled';

export type GenderPreference = 'any' | 'women' | 'men';

export type Visibility = 'public' | 'invite';

/** Account moderation state. New accounts are 'active' immediately (no gating). */
export type UserStatus = 'active' | 'suspended' | 'banned';

export type UserRole = 'user' | 'admin';
export type HostPlan = 'free' | 'pro' | 'premium';
export type SubscriptionStatus = 'inactive' | 'active' | 'past_due' | 'canceled';
export type PriorityLevel = 'standard' | 'express' | 'priority';
export type SponsorshipTier = 'bronze' | 'silver' | 'gold';

/** Per-user relationship to an event, derived for the current viewer. */
export type ViewerRsvp = 'not_joined' | 'joined' | 'waitlisted' | 'host' | 'past';

export interface UserActivity {
  activityId: string;
  level: SkillLevel;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  city: string;
  activities: UserActivity[];
  verified: boolean;
  rating: number; // 0–5 (legacy public review average)
  reviewCount: number;
  badges: string[];
  isTraveler?: boolean;
  lookingFor: LookingFor;
  joinedAt: string; // ISO

  // --- Trust & safety (de-gated; active immediately) ---
  status: UserStatus;
  role: UserRole;
  /** Average of received private ratings. Defaults to 5.0. */
  trustScore: number;
  /** Number of distinct activities where this user was rated 1–2 stars. */
  flagCount: number;
  /** ISO timestamp the current suspension lapses (when status === 'suspended'). */
  suspendedUntil?: string;

  // --- Profile fields ---
  neighborhood?: string;
  zip?: string;
  /** ISO date (used for the client-side 18+ check). */
  birthday?: string;
  /** Optional, unverified — no SMS. */
  phone?: string;
  subscriptionPlan?: HostPlan;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionEndsAt?: string;
  cardLastFour?: string;
  isPremiumUser?: boolean;
  premiumUntil?: string;
  creditAmountCents?: number;
}

export interface Activity {
  id: string;
  name: string;
  /** Legacy emoji label — kept for back-compat but no longer rendered in chrome. */
  icon: string;
  /** lucide-react icon name; every activity (incl. custom) now uses a line icon. */
  lucideIcon?: string;
  category: ActivityCategory; // granular subcategory (racket/water/social/…)
  group: ActivityGroup; // high-level: sport | outdoor | social
  vibe: Vibe; // chill | active
  colorToken: string; // muted accent token, e.g. 'act-clay'
  outdoor: boolean;
  isCustom: boolean;
  createdBy?: string;
}

export interface Spot {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  activityIds: string[];
}

export interface Attendee {
  userId: string;
  status: RsvpStatus;
  /** waitlist position (1-based) when status === 'waitlisted'. */
  waitPosition?: number;
  joinedAt: string;
}

export interface EventLocation {
  lat: number;
  lng: number;
  label: string;
}

export interface JmaaEvent {
  id: string;
  activityId: string;
  title: string;
  hostId: string;
  spotId?: string;
  location?: EventLocation; // used when no saved spot
  startsAt: string; // ISO
  durationMins: number;
  capacity: number;
  minPlayers: number;
  skillLevel: SkillLevel;
  price: number; // 0 = free, in MAD
  description: string;
  travelersWelcome: boolean;
  visibility: Visibility;
  /** Optional per-event override; falls back to the activity's vibe. */
  vibe?: Vibe;
  attendees: Attendee[];
  status: EventStatus;

  // --- Lifecycle & safety (normalized at store-load so always present at runtime) ---
  /** Real-world lifecycle. New activities go 'live' immediately — no pending state. */
  lifecycle?: EventLifecycle;
  genderPreference?: GenderPreference;
  /** Explicit end time; if absent, derived from startsAt + durationMins. */
  endsAt?: string;
  /** Set when the host taps "Start activity". */
  startedAt?: string;
  /** Host's "how to spot me" note, shown to attendees once started. */
  hostSpotNote?: string;
  priorityLevel?: PriorityLevel;
  expressPaymentIntentId?: string;
  expressFeePaid?: boolean;
  approvedAt?: string;
  pinnedUntil?: string;
  businessId?: string;
  /** When the activity was created — drives the weekly free-activity limit. */
  createdAt?: string;
}

export interface Conditions {
  spotId: string;
  activityType: ActivityCategory;
  updatedAt: string;
  fields: {
    swellM?: number;
    windKts?: number;
    tempC?: number;
    waterTempC?: number;
    summary: string;
    icon?: string; // lucide icon key for the summary
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  sentAt: string;
  pending?: boolean;
}

export interface ChatThread {
  id: string;
  eventId?: string;
  title?: string; // for group chats
  participantIds: string[];
  messages: ChatMessage[];
  /** Group chats auto-expire 24h after the activity ends. */
  expiresAt?: string;
}

/** Private rating (host↔attendee). Never shown publicly; feeds trust score. */
export interface Rating {
  id: string;
  fromUserId: string;
  toUserId: string;
  activityId: string; // the event id being rated within
  score: number; // 1–5
  type: 'host_to_attendee' | 'attendee_to_host';
  private: true;
  createdAt: string;
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: 'user' | 'activity';
  targetId: string;
  reason: string;
  chatThreadId?: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface Review {
  id: string;
  eventId: string;
  fromUserId: string;
  toUserId: string;
  rating: number;
  text: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type:
    | 'reminder'
    | 'join_request'
    | 'chat'
    | 'confirmed'
    | 'review'
    | 'start'
    | 'rate'
    | 'report'
    | 'admin';
  title: string;
  body: string;
  eventId?: string;
  fromUserId?: string;
  /** Marks a notification that should deep-link into the rating flow. */
  ratePrompt?: boolean;
  createdAt: string;
  read: boolean;
}

// ---- Filters & input shapes -----------------------------------------------

export interface EventFilters {
  city?: string;
  activityId?: string;
  group?: ActivityGroup;
  vibe?: Vibe;
  date?: 'today' | 'tomorrow' | 'weekend' | 'week' | 'any';
  skillLevel?: SkillLevel;
  openSpotsOnly?: boolean;
  travelersOnly?: boolean;
  search?: string;
  /** Named intent collection key (see lib/collections). */
  collection?: string;
}

export interface CreateEventInput {
  activityId: string;
  title: string;
  spotId?: string;
  location?: EventLocation;
  startsAt: string;
  durationMins: number;
  capacity: number;
  minPlayers: number;
  skillLevel: SkillLevel;
  price: number;
  description: string;
  travelersWelcome: boolean;
  visibility: Visibility;
  vibe?: Vibe;
  genderPreference?: GenderPreference;
  /** Required UI confirmation that the venue is a public place. */
  publicPlaceConfirmed?: boolean;
  priorityLevel?: PriorityLevel;
  expressPaymentIntentId?: string;
  businessId?: string;
}

export interface SponsoredVenue {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  tier: SponsorshipTier;
  used: number;
  limit: number | null;
  remaining: number | 'unlimited';
}

export interface SignupInput {
  name: string;
  email: string;
  password?: string;
  avatar?: string;
  city?: string;
  neighborhood?: string;
  zip?: string;
  birthday?: string;
  phone?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  /** True when created via the mocked Google OAuth button. */
  google?: boolean;
}

export interface RatingInput {
  toUserId: string;
  activityId: string;
  score: number;
  type: Rating['type'];
}

export interface ReportInput {
  targetType: Report['targetType'];
  targetId: string;
  reason: string;
  chatThreadId?: string;
}

export interface CreateActivityInput {
  name: string;
  lucideIcon: string; // chosen line icon key
  category: ActivityCategory;
  group: ActivityGroup;
  vibe: Vibe;
  outdoor: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Event enriched with resolved relations for convenient rendering. */
export interface EnrichedEvent extends JmaaEvent {
  activity: Activity;
  host: User;
  spot?: Spot;
  goingCount: number;
  waitlistCount: number;
  openSpots: number;
  viewerStatus: ViewerRsvp;
  resolvedLocation: EventLocation;
}
