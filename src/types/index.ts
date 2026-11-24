// ---------------------------------------------------------------------------
// Shared domain types for hudlgo.
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

/** What a user is on hudlgo for — drives Discover personalization. */
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

export type UserRole = 'user' | 'admin' | 'business';
// 'pro' is the single live paid host plan; bronze/silver/gold are legacy.
export type HostPlan = 'free' | 'pro' | 'bronze' | 'silver' | 'gold';
export type SubscriptionStatus = 'inactive' | 'active' | 'past_due' | 'canceled';
export type PriorityLevel = 'standard' | 'express' | 'priority';
export type SponsorshipTier = 'starter' | 'bronze' | 'silver' | 'gold';
export type BillingInterval = 'monthly' | 'quarterly' | 'annual';

// --- Manual upgrades (paid offline, activated by an admin) ---
export type UpgradeProduct = 'pro_host' | 'sponsorship_starter' | 'sponsorship_bronze' | 'sponsorship_silver' | 'pinned_activity';
export type UpgradeStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface UpgradeRequest {
  id: string;
  product: UpgradeProduct;
  status: UpgradeStatus;
  /** Short code the customer writes on their transfer (e.g. HG-4F7K2). */
  reference: string;
  amountCents: number;
  billingInterval?: BillingInterval;
  businessId?: string;
  businessName?: string;
  venueId?: string;
  eventId?: string;
  eventTitle?: string;
  eventStartsAt?: string;
  note?: string;
  adminNote?: string;
  grantedUntil?: string;
  createdAt: string;
  decidedAt?: string;
  /** Localized payment instructions (pending requests only). */
  instructions?: string;
  /** Admin listing only. */
  user?: { id: string; name: string; email: string };
}

export interface CreateUpgradeInput {
  product: UpgradeProduct;
  interval?: BillingInterval;
  businessId?: string;
  venueId?: string;
  eventId?: string;
  note?: string;
  locale?: string;
}

/** Admin plans screen: a person's host plan. */
export interface AdminUserPlan {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  status: string;
  endsAt?: string;
}

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
  /** True once identity (selfie) verification is approved — shows a check mark. */
  verified: boolean;
  /** Selfie-verification state for the owner's own account. */
  verificationStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  /** Admin-only: the submitted selfie + prompted pose (for review). */
  verificationSelfieUrl?: string;
  verificationPose?: string;
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
  /** Whether the user receives email mirrors of their in-app notifications. */
  emailNotifications?: boolean;
  /** False until the user confirms their email (can browse, but not host/join/chat). */
  emailVerified?: boolean;
  /** Preferred UI language, synced to the backend to localize emails. */
  locale?: string;
  /** Set when this account owns a sponsored venue — switches to the business UI. */
  businessId?: string;
}

export interface MyBusinessActivity {
  id: string;
  title: string;
  activityType: string;
  hostName: string;
  startsAt: string;
  endsAt?: string;
  going?: number;
  capacity?: number;
  price?: number;
  status?: string;
  locationLabel?: string;
  couponCode?: string;
  /** Coupons redeemed for this activity so far. */
  redemptions?: number;
}

export interface MyBusiness {
  business: {
    id: string;
    name: string;
    description: string;
    address: string;
    lat?: number;
    lng?: number;
    phone: string;
    contactEmail: string;
    status: string;
    photos: string[];
    /** Silver perk text attendees see with their coupon (default offer when unset). */
    couponOffer?: string;
  };
  sponsorship: {
    tier: SponsorshipTier;
    status: string;
    used: number;
    limit: number | 'unlimited';
    remaining: number | 'unlimited';
    startDate: string;
    endDate?: string;
    billingInterval?: BillingInterval;
    monthlyPriceCents: number;
  } | null;
  activities: MyBusinessActivity[];
}

// ---- Business side (Foundation) -------------------------------------------
export type BusinessRole = 'owner' | 'manager' | 'staff';

/** A business organization the current user belongs to (business-mode context). */
export interface BusinessOrg {
  id: string;
  name: string;
  category: string;
  legalName?: string;
  rcNumber?: string;
  iceNumber?: string;
  description: string;
  address: string;
  lat?: number;
  lng?: number;
  contactEmail: string;
  phone: string;
  website?: string;
  logoUrl: string | null;
  coverUrl: string | null;
  status: string; // pending_verification | verified | rejected | suspended
  verified: boolean;
  role: BusinessRole;
}

export interface VenueCard {
  id: string;
  businessId: string | null;
  name: string;
  slug: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  photos: string[];
  status: string; // listed | claimed | verified
  avgRating: number;
  reviewCount: number;
}

export interface VenueReviewView {
  id: string;
  rating: number;
  text: string;
  authorName: string;
  authorPhoto: string | null;
  createdAt: string;
}

export interface VenueUpcomingEvent {
  id: string;
  title: string;
  startsAt: string;
  activityType: string;
  hostName: string;
}

export interface VenueProfile extends VenueCard {
  description: string;
  amenities: string[];
  hours: Record<string, string>;
  phone: string | null;
  website: string | null;
  business: { id: string; name: string; verified: boolean; logoUrl: string | null } | null;
  upcomingEvents: VenueUpcomingEvent[];
  reviews: VenueReviewView[];
}

export interface AdminBusinessVerification {
  id: string;
  businessId: string;
  businessName: string;
  category: string;
  contactEmail: string;
  rcNumber?: string;
  iceNumber?: string;
  documentUrls: string[];
  submittedAt: string;
}

export interface AdminVenueClaim {
  id: string;
  venueId: string;
  venueName: string;
  venueAddress: string;
  businessId: string;
  businessName: string;
  evidence: string[];
  submittedAt: string;
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
  /** Real backend: the venue's street address and listing status. */
  address?: string;
  status?: 'listed' | 'claimed' | 'verified';
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
  /** Host-entered general area shown before joining (e.g. "Maârif"). */
  areaLabel?: string;
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
  /** Set when the host confirms the activity is happening (avoids auto-cancel). */
  hostConfirmedAt?: string;
  /** Host's "how to spot me" note, shown to attendees once started. */
  hostSpotNote?: string;
  priorityLevel?: PriorityLevel;
  expressPaymentIntentId?: string;
  expressFeePaid?: boolean;
  /** Extra activity hidden until its offline payment is confirmed by an admin. */
  awaitingPayment?: boolean;
  approvedAt?: string;
  pinnedUntil?: string;
  businessId?: string;
  /** When the activity was created — drives the weekly free-activity limit. */
  createdAt?: string;
  /** Hidden pending admin review (auto-set when reported). */
  underReview?: boolean;
  /** Online (virtual) activity — no physical venue. */
  isOnline?: boolean;
  /** Meeting link for online activities; only revealed to members. */
  meetingUrl?: string;
}

export interface Conditions {
  spotId: string;
  activityType: ActivityCategory | string;
  updatedAt: string;
  /** "open-meteo" when it's a live forecast from the backend. */
  source?: string;
  fields: {
    swellM?: number;
    /** Wave period in seconds (marine forecast). */
    wavePeriodS?: number;
    windKts?: number;
    tempC?: number;
    waterTempC?: number;
    /** English fallback text. */
    summary: string;
    /** Translatable key from the backend: clear | cloudy | fog | rain | showers | snow | storm | windy. */
    summaryKey?: string;
    icon?: string; // lucide icon key for the summary
  };
}

/** Where/when to fetch outdoor conditions for an activity. */
export interface ConditionsQuery {
  lat: number;
  lng: number;
  /** ISO start time of the activity. */
  at: string;
  /** Activity slug — water sports add sea conditions. */
  activityId?: string;
  /** Mock-only: the seeded spot's canned conditions. */
  spotId?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  sentAt: string;
  pending?: boolean;
  /** Sender display info (sent by the backend; the mock resolves it locally). */
  sender?: { id: string; name: string; avatar: string };
}

export interface ChatThread {
  id: string;
  eventId?: string;
  title?: string; // for group chats
  participantIds: string[];
  messages: ChatMessage[];
  /** Group chats auto-expire 24h after the activity ends. */
  expiresAt?: string;
  /** Activity start/end (group chats) — drives the date shown + read-only state. */
  startsAt?: string;
  endsAt?: string;
  /** True once the activity has ended — no new messages allowed. */
  ended?: boolean;
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
  /** Embedded reviewer info (so reviews render for real backend users too). */
  fromName?: string;
  fromAvatar?: string;
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
  /** Sort order. 'distance' needs lat/lng (used by the "Near me" option). */
  sort?: 'soonest' | 'distance';
  /** Viewer coordinates for distance sort — overrides the city scope. */
  lat?: number;
  lng?: number;
}

export interface CreateEventInput {
  activityId: string;
  title: string;
  spotId?: string;
  location?: EventLocation;
  areaLabel?: string;
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
  /** Online (virtual) activity — no physical venue. */
  isOnline?: boolean;
  /** Optional meeting link for online activities. */
  meetingUrl?: string;
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
  /** Cloudflare Turnstile token (sent when the CAPTCHA is configured). */
  turnstileToken?: string;
  /** Referral code from an invite link (?ref=...). Credits both users with Pro days. */
  referralCode?: string;
  /** UI language at signup — localizes the verification email. */
  locale?: string;
}

/** A user's invite link + how many friends have joined via it. */
export interface ReferralSummary {
  code: string;
  link: string;
  joinedCount: number;
  rewardDays: number;
}

export interface RatingInput {
  toUserId: string;
  activityId: string;
  score: number;
  type: Rating['type'];
  /** Optional written review — shown publicly on the recipient's profile. */
  comment?: string;
}

export type ReportCategory = 'fake_activity' | 'inappropriate' | 'no_show_host' | 'suspicious_user' | 'other';

export interface ReportInput {
  targetType: Report['targetType'];
  targetId: string;
  category?: ReportCategory;
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
/** A joined attendee's personal coupon for a Silver-sponsored activity. */
export interface EventCoupon {
  code: string;
  offer?: string;
  venueName: string;
  /** True on the activity's day ± 1 (Morocco time). */
  redeemable: boolean;
  redeemedAt?: string;
}

/** Staff-side result of checking a coupon code. */
export interface CouponCheck {
  ok: boolean;
  problem?: 'INVALID_CODE' | 'NOT_FOUND' | 'NEED_ATTENDEE_CODE' | 'OUT_OF_WINDOW' | 'ALREADY_REDEEMED';
  code?: string;
  offer?: string;
  activity?: { id: string; title: string; startsAt: string };
  attendee?: { id: string; name: string; avatar: string };
  redeemedAt?: string;
}

export interface EnrichedEvent extends JmaaEvent {
  /** Present for joined attendees of a Silver-sponsored activity. */
  coupon?: EventCoupon;
  /** Returned by createEvent when a pin / extra-activity request was filed. */
  upgradeRequest?: UpgradeRequest;
  activity: Activity;
  host: User;
  spot?: Spot;
  /** Public profiles of attendees (excludes the host); supplied by the backend. */
  attendeeUsers?: User[];
  goingCount: number;
  waitlistCount: number;
  openSpots: number;
  viewerStatus: ViewerRsvp;
  resolvedLocation: EventLocation;
  /** Set when hosted at a sponsored business venue — pinned & badged in the feed. */
  sponsoredVenue?: { name: string; tier: SponsorshipTier };
  /** Currently featured (pin still active) — shows a "Featured" badge + floats up the feed. */
  pinned?: boolean;
  /** True when the viewer hasn't joined — exact address/pin are hidden. */
  locationHidden?: boolean;
  /** Coarse area shown before joining (host's areaLabel or nearest city). */
  generalArea?: string;
}
