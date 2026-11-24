# hudlgo — Architecture & Project Overview

> A Morocco-first meetup / activity app. When you're bored and want to meet people, you
> create or join an IRL activity — coffee, padel, surf, board games, hikes, language
> exchange — and the activity is the vehicle for connection. It's a **two-sided
> marketplace**: regular consumers on one side, venues/businesses on the other.

It started as a frontend-only mock prototype (the offline mock is still there for demos) and has
since grown a full **NestJS + Prisma + MySQL** backend, a **two-sided
business side**, and **manually activated paid plans** (customers pay offline, an admin
grants the plan; there is no payment gateway).

---

## 1. Tech stack

| Layer | Choice |
|---|---|
| **Frontend** | Vite + React 18 + TypeScript, Tailwind CSS, React Router, Zustand (state), react-i18next (en/fr/ar), react-leaflet + OpenStreetMap, lucide-react icons, date-fns |
| **Backend** | NestJS 10, Prisma 5 ORM, MySQL 8, Passport (JWT + Google OAuth), class-validator, @nestjs/throttler, @nestjs/schedule, Swagger, helmet |
| **Payments** | None online: offline payment (bank transfer / CashPlus / cash) + admin-approved upgrade requests |
| **Realtime** | socket.io (`@nestjs/platform-socket.io` + `socket.io-client`) for chat and live notification counts |
| **Infra** | Docker Compose on one VPS behind Traefik; local-disk uploads (sharp re-encoding, swappable `StorageDriver`); Resend (email); Open-Meteo (weather, no key); `scripts/backup.sh` |

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
- **`Notification`**, **`Feedback`**, **`RefreshToken`**, **`AuthToken`** (hashed one-time
  password-reset / email-verification tokens), **`SubscriptionEvent`** (audit log of plan
  grants / extensions / revocations / expiries; historically the Paddle order log).
- **`UpgradeRequest`**: a customer's request for a paid plan (`PRO_HOST`, `SPONSORSHIP_*`,
  `PINNED_ACTIVITY`) with its amount, a short payment `reference` (`HG-XXXXX`) and its status
  (`PENDING → APPROVED | REJECTED | CANCELLED`).

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
- **Monetization** ([monetization.module.ts](server/src/monetization/monetization.module.ts)):
  plan allowances (`GET /subscriptions/me`), the business/sponsorship surface
  (`/businesses/sponsored-venues`, `/mine`, `/register`), and the **manual upgrade flow**:
  `POST /upgrades`, `GET /upgrades/mine`, `POST /upgrades/:id/cancel`, plus admin
  `GET /admin/upgrade-requests`, `POST /admin/upgrade-requests/:id/approve|reject`,
  `POST /admin/users/:id/plan`, `POST /admin/businesses/:id/sponsorship`. Every plan change
  goes through `PlanGrantsService`, which writes the audit log.
- **Admin** ([admin.controller.ts](server/src/admin/admin.controller.ts)) — overview/analytics,
  reports, flagged users, subscribers, business verifications, venue claims, venue-review
  moderation, activity approval queue, identity-verification queue, and moderation actions
  (warn/suspend/ban).
- **Auth extras**: `POST /auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`,
  `/auth/resend-verification` (hashed one-time `AuthToken`s). `EmailVerifiedGuard` returns
  `code: EMAIL_NOT_VERIFIED` and gates creating/joining activities and sending chat messages.
- **Realtime** ([chat.gateway.ts](server/src/chat/chat.gateway.ts)): JWT handshake, `user:<id>`
  rooms, `thread:join` using `ChatService.assertCanView`. Emits `message:new`, `chat:activity`,
  `notification:new` and `notification:unread` through the global `RealtimeService`.
- **Conditions**: `GET /conditions?lat&lng&at&activity` → Open-Meteo forecast + marine data, with
  a 30-min in-memory cache. Returns `null` when unavailable.
- **Blocks**: `POST|DELETE /users/:id/block`, `GET /users/me/blocks`. `BlocksService` is used by
  events (feed, detail, join), users (profile 404) and chat (history + live emits).
- **Coupons**: `GET /businesses/:id/coupons/lookup`, `POST /businesses/:id/coupons/redeem`
  (STAFF+). Codes are the activity coupon plus a per-attendee HMAC suffix.
- **Infra**: Prisma, Trust, Storage (signature-checked uploads, WebP re-encode, EXIF stripped,
  old files deleted; `StorageDriver` interface), Geocoding, Notifications, Mail (Resend,
  EN/FR/AR auth emails), **Scheduler** (cron jobs, incl. plan expiry and renewal reminders).

**Guards & access control**
- `JwtAuthGuard` (global) + `@Public`/`@OptionalAuth`.
- `RolesGuard` for `ADMIN`.
- `ConsumerGuard` — blocks `BUSINESS`-role accounts from consumer-only actions (joining, rating
  people, identity verification).
- `BusinessRoleGuard` + `@BusinessRoles(...)`: enforces OWNER⊇MANAGER⊇STAFF on business/venue
  routes. The business's `ownerId` account always counts as OWNER.
- `EmailVerifiedGuard`: create/join/chat-send require a verified email.

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

## 6. Monetization & payments (manual, no gateway)

**What's sold** (prices in **MAD**):
- **Host plans** (consumer): **Free** (1 activity/day, 0 pins) and **Pro Host** (49 MAD/mo,
  unlimited hosting + 7 auto-pins/week). `PlanType` = FREE/PRO (BRONZE/SILVER/GOLD are legacy values).
- **Pinned / extra activity**: 19.90 MAD. It pins an activity **until it starts**. When a Free host
  has used today's activity, it also lets them host one more.
- **Business venue sponsorships**: **Starter / Bronze / Silver (199 / 490 / 990 MAD per month)**, with
  monthly activity quotas (2 / 5 / 15), feed priority, badges and (Silver) per-activity coupon codes.
  Terms: one month, or a prepaid quarter (−10%) / year (−15%). GOLD is a dormant legacy tier.

**How customers pay**: offline (bank transfer, CashPlus or cash). There is no payment gateway,
no card data and no auto-renewal.
1. The customer files an **`UpgradeRequest`**: *Request upgrade* on Pricing (Pro Host), on the
   business signup / *Plan* page (sponsorships), or by choosing *Pinned* in the create flow.
   The response includes the amount, a short **reference** (`HG-XXXXX`) and the **payment
   instructions**. Those come from `PAYMENT_INSTRUCTIONS_EN|FR|AR` with `{amount}` / `{reference}`
   placeholders.
2. Over-quota "extra" activities are created right away with `Event.awaitingPayment = true`. They
   stay hidden and out of the normal approval queue until their request is approved.
3. An admin checks that the payment arrived and approves the request in **/admin → Upgrade
   requests**. They choose the length (default 1 / 3 / 12 months from the requested term) or an
   exact end date. Approval goes through `PlanGrantsService`:
   - Pro Host → `subscriptionPlan=PRO, ACTIVE, subscriptionEndsAt`, stacked on any remaining Pro time.
   - Sponsorship → extends a same-tier sponsorship, or replaces it with the new tier, and marks
     the business VERIFIED.
   - Pin → `pinnedUntil = startsAt`, and publishes the activity if it was awaiting payment.
4. Admins can also **grant / extend / revoke** plans directly in **/admin → Plans**. Every change
   is written to `SubscriptionEvent` with the admin's id.
5. **Scheduler**: hourly expiry (Pro → Free, sponsorship → EXPIRED), a renewal reminder (email +
   in-app) about 5 days before the end date, and cancellation of pin requests whose activity has
   already started.

The old Paddle columns (`paddleCustomerId`, `paddleSubscriptionId`, `paddleEventId`) remain in the
schema unused, because there are no destructive migrations.

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
profile/settings/verify, notifications, admin panel, monetization (pricing/business signup/upgrade requests
payment), venues browse/detail, and the full business suite (onboarding, dashboard, venue,
activity detail with attendees, business chat).

**State** — Zustand stores: `session` (auth/user/onboarding, persisted to localStorage), `theme`
(dark mode via CSS vars), `toast`.

**Realtime** ([src/lib/socket.ts](src/lib/socket.ts), [useRealtime.ts](src/hooks/useRealtime.ts)):
one shared socket opened by the layouts after login. It re-handshakes on token refresh,
refreshes the token on an expired handshake, disconnects on logout, and does nothing in mock
mode. Screens refetch after a reconnect or when the tab becomes visible again.

**i18n / RTL**: all UI strings go through `t()` with full EN/FR/AR parity. Arabic sets
`dir="rtl"`, layouts use logical Tailwind classes (`ms-`/`pe-`/`start-`/`text-start`/`rounded-ee-`)
and directional icons are mirrored with `rtl:-scale-x-100`. Backend error `code`s (e.g.
`EMAIL_NOT_VERIFIED`) are translated globally from `errors.*`.

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

**Tests**: `cd server && npm run test:e2e` runs the end-to-end suites in
[server/test/](server/test/): smoke, auth recovery, realtime, conditions, upgrades, uploads,
blocks and coupons. They need a migrated and seeded MySQL in `DATABASE_URL`.

---

## 9. Current state & what's not built

**Built**
- Consumer app: auth (email + Google), **email verification + password reset**, discover,
  activities + lifecycle, **real-time group chat**, ratings, trust, reports, **blocking**,
  identity verification, notifications (live badge), admin panel with analytics.
- Business side: orgs/members/roles, venues + claims, business verification, §7 privacy
  boundary, venue sponsorships, **Silver coupon redemption** with a staff redeem screen and
  per-activity counts.
- **Manual monetization**: upgrade requests paid offline, admin approval or direct grants with
  an audit log, expiry and renewal reminders. Paddle has been removed.
- Real outdoor conditions (Open-Meteo); saved places backed by real venues.
- Safe local uploads (validation, WebP re-encode, EXIF/GPS stripped, old-file clean-up), daily
  backups with optional Google Drive copy, full EN/FR/AR with RTL.

**Not yet built / known gaps**
- **Direct messages** don't exist on the backend. The profile "Message" button only appears in
  the offline mock.
- Invited business **STAFF** members can use the coupon API, but the app only gives the
  business UI to the owner account.
- Legal pages (Terms / Privacy / Refunds) are English-only prose and need a professional FR/AR
  translation.
- Business Phase 2–4 (TVA/invoices, promotions, HYBRID events, follows, digests) and safety
  Phases 3–5 (quiz, checkpoints, stronger CAPTCHA).
- Uploads live on the VPS disk. An S3-compatible `StorageDriver` can be added when needed.

---

_Last updated: 2026-11-24._
