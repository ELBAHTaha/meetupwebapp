# Jmaâ (codename `hudlgo`) — Architecture & Project Overview

> A Morocco-first meetup / activity app. When you're bored and want to meet people, you
> create or join an IRL activity — coffee, padel, surf, board games, hikes, language
> exchange — and the activity is the vehicle for connection. It's a **two-sided
> marketplace**: regular consumers on one side, venues/businesses on the other.

It started as a frontend-only mock prototype (which the original [README.md](README.md) still
describes) and has since grown a full **NestJS + Prisma + MySQL** backend, a **two-sided
business side**, and a **Paddle (Billing) payment integration**.

---

## 1. Tech stack

| Layer | Choice |
|---|---|
| **Frontend** | Vite + React 18 + TypeScript, Tailwind CSS, React Router, Zustand (state), react-i18next (en/fr/ar), react-leaflet + OpenStreetMap, lucide-react icons, date-fns |
| **Backend** | NestJS 10, Prisma 5 ORM, MySQL 8, Passport (JWT + Google OAuth), class-validator, @nestjs/throttler, @nestjs/schedule, Swagger, helmet |
| **Payments** | Paddle Billing (merchant-of-record: server-created transactions + Paddle.js overlay + signed webhooks), with a dev-simulation fallback when keys are unset |
| **Infra** | Docker Compose (MySQL on :3307, optional api container), local-disk file storage, Resend (email) |

Two apps in one repo: the **frontend** at the repo root ([package.json](package.json), name
`hudlgo`) and the **backend** under [server/](server/) ([server/package.json](server/package.json),
name `hudlgo-server`).

---

## 2. Repository layout

```
meetupwebapp/
├─ src/                      # FRONTEND (React + Vite)
│  ├─ api/                   # the single API seam (mock ↔ remote), types, http client
│  ├─ components/            # reusable UI primitives (Button, EventCard, MapView, …)
│  ├─ features/              # feature folders (auth, discover, event, create, chat,
│  │                         #   profile, business, venues, admin, monetization, …)
│  ├─ routes/index.tsx       # React Router config + route guards
│  ├─ store/                 # Zustand stores (session, theme, toast)
│  ├─ i18n/                  # en/fr/ar JSON + config
│  └─ lib/, hooks/, styles/, types/
└─ server/                   # BACKEND (NestJS)
   ├─ prisma/schema.prisma   # the canonical data model
   ├─ prisma/seed.ts
   └─ src/                   # one folder per feature module (see §4)
```

---

## 3. Data model ([server/prisma/schema.prisma](server/prisma/schema.prisma))

The schema is the backbone. Key entities:

**Consumer core**
- **`User`** — person account. Auth (email/password or `googleId`), profile (photo, bio,
  neighborhood/zip/lat/lng, birthday, gender, `lookingFor`), **role** (`USER | ADMIN |
  BUSINESS`), **status** (`ACTIVE | SUSPENDED | BANNED`), **trust** (`trustScore` 0–5 default
  5.0, `reliabilityAdj`, `flagCount`), **identity verification** (selfie+pose,
  `verificationStatus`), and **monetization** (`subscriptionPlan`, `subscriptionStatus`,
  `isPremiumUser`, `creditAmountCents`).
- **`ActivityType`** — catalog entry (e.g. "Padel"): icon, `category` (SPORT/OUTDOOR/SOCIAL),
  `vibe`, `outdoor`, `isCustom` (users can create their own).
- **`Event`** — a meetup ("activity"). Host, activity type, location (label/address/lat/lng +
  `isPublicPlace`), optional **online mode** (`isOnline`/`meetingUrl`), optional **`venueId`**,
  time window, `maxAttendees`/`minPlayers`, price, `genderPreference`, `visibility`, **`status`**
  (LIVE/COMPLETED/CANCELLED), lifecycle timestamps (`startedAt`, `hostConfirmedAt`, `approvedAt`,
  `pinnedUntil`, `reminderSentAt`, `ratePromptSentAt`), and monetization (`priorityLevel`,
  `expressFeePaid`).
- **`Attendance`** — RSVP join row (`JOINED | WAITLISTED` + `waitlistPosition`), plus the §7
  privacy field `shareContactWithHostBusiness`.
- **`ChatThread` / `ChatMessage`** — one thread per event, `expiresAt = endsAt + 24h`.
- **`Rating` / `Flag`** — private post-event peer ratings (host↔attendee, 1–5); a low rating
  creates a Flag.
- **`Report` / `BannedContact` / `ModerationAction`** — abuse reporting + admin actions;
  banned email/phone hashes block re-signup.
- **`Notification`**, **`Feedback`**, **`RefreshToken`**, **`SubscriptionEvent`** (webhook /
  payment idempotency log).

**Business side (two-sided marketplace)**
- **`Business`** — org with legal info (`rcNumber`/`iceNumber` — Moroccan RC/ICE), category,
  logo/cover, `status` (`PENDING_VERIFICATION | VERIFIED | REJECTED | SUSPENDED`), `ownerId`.
- **`BusinessMember`** — team membership with role hierarchy `OWNER ⊇ MANAGER ⊇ STAFF`; how a
  person account unlocks "business mode."
- **`BusinessVerification`** — RC/ICE + document submission reviewed by an admin.
- **`Venue`** — first-class venue (can be unclaimed, `businessId` nullable), photos/amenities/
  hours, `status` (LISTED/CLAIMED/VERIFIED), aggregate `avgRating`/`reviewCount`.
- **`VenueClaim`** — a business claiming an existing venue (admin-reviewed).
- **`VenueReview`** — venue reviews, gated on having attended an event there (`attendedEventId`),
  separate from person trust scores.
- **`Sponsorship` / `ActivityVenue`** — venue sponsorship: a business sponsors a venue tier
  (`SponsorshipTier` STARTER/BRONZE/SILVER sellable, GOLD dormant/legacy) with a monthly activity
  quota and a `billingInterval` (MONTHLY/QUARTERLY/ANNUAL prepaid term + `endDate`); `ActivityVenue`
  links an event to the sponsoring business and carries the **coupon code** (Silver perk).

---

## 4. Backend architecture ([server/src/](server/src/))

NestJS, one module per feature, wired in [app.module.ts](server/src/app.module.ts). Bootstrap
([main.ts](server/src/main.ts)) sets up helmet, CORS, a global `ValidationPipe` (whitelist +
transform), a global `JwtAuthGuard` (routes opt out with `@Public`/`@OptionalAuth`), a global
`ThrottlerGuard`, static file serving for uploads, and Swagger at `/docs`.

**Modules & endpoints**
- **Auth** ([auth.controller.ts](server/src/auth/auth.controller.ts)) — `POST /auth/signup`,
  `/auth/business/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`, Google OAuth
  (`/auth/google[/callback]`), `GET /auth/me`. JWT access + refresh (refresh tokens hashed in DB),
  bcrypt passwords.
- **Users** — `GET/PATCH /users/me`, notifications, `POST /users/me/verification` (selfie
  identity verification), `GET /users/:id`.
- **Events** ([events.service.ts](server/src/events/events.service.ts)) — the core domain.
  `GET /events` (filtered feed), `/events/mine`, `/events/:id`, `/events/:id/attendees`,
  `POST /events`, `PATCH /events/:id`, lifecycle actions `cancel`/`confirm`/`start`/`join`/`leave`.
  Create throttle is env-aware (5/hr prod, 200/hr dev).
- **Activity types**, **Chat**, **Ratings** (`POST /events/:id/ratings`, `GET .../pending`,
  `GET /users/:id/reviews`), **Reports**, **Feedback** (+ admin feedback).
- **Business org** ([business-org.controller.ts](server/src/business/business-org.controller.ts))
  — `POST /businesses`, `GET /me/businesses`, `GET/PATCH /businesses/:id`, verification submit,
  member invite/accept/role/remove.
- **Venues** ([venue.controller.ts](server/src/business/venue.controller.ts)) — browse/search,
  profile, create/update, `POST /venues/:id/claim`, `POST /venues/:id/reviews`.
- **Monetization** ([monetization.module.ts](server/src/monetization/monetization.module.ts)) —
  subscriptions/checkout, express (extra-activity) payments, and the business/sponsorship
  surface (`/businesses/sponsored-venues`, `/mine`, `/register`, `/:id/sponsorship-checkout`).
  All three open a Paddle transaction; the frontend completes it in the overlay.
- **Payments** ([payments.module.ts](server/src/payments/payments.module.ts)) — the **Paddle
  gateway**: provider-agnostic `PaymentsService` over `PaddleService` (server-created transaction
  against a catalog price id → Paddle.js overlay → signed `transaction.completed`/`subscription.*`
  webhooks at `POST /payments/paddle/webhook`), with a dev-simulation fallback when keys aren't set.
- **Admin** ([admin.controller.ts](server/src/admin/admin.controller.ts)) — overview/analytics,
  reports, flagged users, subscribers, business verifications, venue claims, venue-review
  moderation, activity approval queue, identity-verification queue, and moderation actions
  (warn/suspend/ban).
- **Infra** — Prisma, Trust, Storage (local-disk uploads), Geocoding (nearest-city/haversine),
  Notifications, Mail (Resend), **Scheduler** (cron jobs).

**Guards & access control**
- `JwtAuthGuard` (global) + `@Public`/`@OptionalAuth`.
- `RolesGuard` for `ADMIN`.
- `ConsumerGuard` — blocks `BUSINESS`-role accounts from consumer-only actions (joining, rating
  people, identity verification).
- `BusinessRoleGuard` + `@BusinessRoles(...)` — enforces OWNER⊇MANAGER⊇STAFF on business/venue
  mutations.

> Route-ordering note: `MonetizationModule` is imported **before** `BusinessModule` so its static
> `/businesses/mine|sponsored-venues|register` routes resolve before the new `GET /businesses/:id`.

---

## 5. Key domain flows

**Activity lifecycle** ([events.service.ts](server/src/events/events.service.ts) +
[scheduler.service.ts](server/src/scheduler/scheduler.service.ts))
- **Create**: must start >4h out, no same-day, public-place required (with a private-home keyword
  check), prohibited-content filter. Normal users' activities wait for **admin approval**
  (`approvedAt` null = hidden); a business hosting at its own sponsored venue goes **live
  instantly**. Free `BUSINESS` accounts may host **exactly one** activity unless they have an
  active sponsorship.
- **RSVP state machine**: `not_joined → joined → waitlisted → host → past`. Joining decrements
  open spots; when full, joiners are waitlisted with a position; leaving **promotes the first
  waitlisted person** and renumbers the rest. Team-sport `minPlayers` gates `PENDING → CONFIRMED`.
- **Cron jobs**: complete ended events + prompt ratings, auto-cancel unconfirmed events (~1h
  before start), day-before reminders, lapse suspensions, monthly sponsorship-quota reset,
  renewal reminders, prune old chats.

**Progressive location disclosure**
([event.serializer.ts](server/src/common/serializers/event.serializer.ts)) — a centralized rule:
only the host/joined/waitlisted/past viewers get the **exact address + pin** and (for online
events) the meeting URL; everyone else sees a **general area + ~1km-fuzzed coordinates**. Computed
per-viewer in `serializeEvent`.

**Trust & safety** — `trustScore` is the average of received private ratings; a 1–2★ rating flags
a user; thresholds (≥2 flags / trust <2.5 / ≥2 reports) surface them in the admin Flagged list.
Hosting a completed activity gives +0.5 trust; late cancels / no-confirm cost trust. Banned
contacts (hashed) block re-registration.

**Feed ranking** — base order by date/distance, then a stable re-sort: sponsored venues on top
(Gold›Silver›Bronze), then pinned host-tier activities, then everything else, with a half-step
boost for verified hosts.

---

## 6. Monetization & payments

- **Host plan** (consumer, overhauled 2026-06-19): **Free** (1 activity/day, 0 pins) + a single
  **Pro Host** plan (49 MAD/mo, unlimited hosting + 7 pins/week). `PlanType` = FREE/PRO
  (BRONZE/SILVER/GOLD kept only as legacy values). Plus a single one-off **19.90 MAD pinned**
  extra activity (`priority`) — used both to pin a free activity and to host an extra one.
- **Business venue sponsorships**: 3 sellable packs **Starter/Bronze/Silver (199/490/990 MAD)** —
  monthly activity quota (2/5/15), feed priority, badges, and (Silver) per-activity **coupon codes**
  (`HUDLGO-XXXXXX`, currently cosmetic — no redemption logic yet). Each pack bills **monthly, or a
  prepaid quarter (−10%) / year (−15%)**. GOLD (1990 MAD, unlimited + 50 MAD host credit) is a
  dormant legacy tier — still in the enum/feed-rank/credit logic but no longer sold.
- Prices are in **MAD**.
- **Gateway**: **Paddle Billing** (merchant of record). All checkouts open a Paddle transaction
  against a catalog price id; the frontend completes it in the **Paddle.js overlay**
  ([src/lib/paddle.ts](src/lib/paddle.ts)) — no card data touches our servers. Orders are fulfilled
  on Paddle's signed `transaction.completed` webhook; `subscription.canceled` /
  `transaction.payment_failed` keep plan status in sync. A dev-simulation fallback marks orders
  paid without real keys ([configuration.ts](server/src/config/configuration.ts) → `paddle.*`).
  Pro Host and sponsorships are **recurring subscriptions** (auto-renew); the one-off pinned extra
  is a one-time charge. Cancelling schedules Paddle to stop at period end and keeps access until then.

---

## 7. Frontend architecture ([src/](src/))

**The API seam** ([src/api/index.ts](src/api/index.ts)) is the single import surface. It spreads
the **mock** implementation then overrides with **remote** when `VITE_API_URL` is set:

```ts
const impl = (USE_REMOTE ? { ...mock, ...remote } : mock) as typeof mock;
```

> ⚠️ Critical gotcha: a function present in `mock.ts` but missing from `remote.ts` silently falls
> back to the mock's `u1` demo user and breaks for real backend users — so new endpoints must be
> added to **both** files (and re-exported from `index.ts`).

**Routing** ([src/routes/index.tsx](src/routes/index.tsx)) — `PublicOnly` wraps
landing/login/signup; `Protected` requires auth + onboarding and **separates consumer vs business
UIs** (a `user.businessId` redirects to `/business/dashboard`; consumers can't reach business
routes). Two route trees: the consumer `AppLayout` (discover, create, chat, profile, event,
venues, admin, pricing, …) and the `BusinessLayout` (dashboard, create activity, venue, activity
detail, chat).

**Feature pages** ([src/features/](src/features/)) — auth/onboarding, discover (feed + filter
sheet + "near me" geolocation), create-event wizard, event detail, chat (list + thread),
profile/settings/verify, notifications, admin panel, monetization (pricing/business/express
payment), venues browse/detail, and the full business suite (onboarding, dashboard, venue,
activity detail with attendees, business chat).

**State** — Zustand stores: `session` (auth/user/onboarding, persisted to localStorage), `theme`
(dark mode via CSS vars), `toast`.

**Design system** (v0.2, [tailwind.config.js](tailwind.config.js)) — warm Moroccan palette (bone
canvas, clay primary, olive/saffron/majorelle accents), Fraunces + Inter type, hairline borders
over shadows, line icons, photo-led cards, dark mode, EN/FR/AR i18n.

---

## 8. How to run it

**Frontend**
```bash
npm install
npm run dev          # Vite on :5173 (mock mode unless VITE_API_URL is set)
```

**Backend** ([server/](server/))
```bash
# MySQL via Docker (on :3307), then:
cd server
npx prisma migrate deploy
npm run seed
npm run start:dev    # Nest on :4000, Swagger at /docs
```

Set `VITE_API_URL=http://localhost:4000` for the frontend to talk to the real backend.

---

## 9. Current state & what's not built

**Built** — full consumer app (auth, discover, events + lifecycle, chat, ratings, trust, reports,
identity verification, notifications, admin panel with analytics), the **Business Foundation
Phase 1** (orgs/members/roles, venues + claims, business verification, §7 attendee-privacy
boundary), and the Paddle payment integration (subscriptions, sponsorships, extra-activity fees).

**Not yet built / pending**
- A real **Offer/redemption** system — the Silver coupon codes are currently display-only.
- **Paddle go-live**: create the products/prices in the Paddle dashboard and fill the
  `PADDLE_*` price ids + API key + webhook secret (and `VITE_PADDLE_CLIENT_TOKEN`), then point a
  Paddle notification destination at `POST /payments/paddle/webhook`.
- Business **Phase 2–4**: billing changes (TVA/invoices), promotions, online/HYBRID event
  modes, follows, digests, analytics dashboards.
- Safety **Phases 2–5**: blocking, quiz, chat filters, checkpoints, CAPTCHA.
- Production hardening: swap local-disk `StorageService` for S3/R2, production env/deploy setup.
- Brand rename from legacy `hudlgo` to **Jmaâ** is incomplete (still in package names, Swagger
  title, coupon prefix, mail sender).

---

_Last updated: 2026-06-19._
