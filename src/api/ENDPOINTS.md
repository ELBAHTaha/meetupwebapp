# API → REST endpoint map

The mock layer in `src/api/index.ts` is a **REST-shaped seam**. Every function returns a
`Promise` and maps 1:1 to a REST endpoint. The real backend lives in **`/server`** (NestJS +
Prisma + MySQL) and implements exactly these paths.

> **Canonical paths:** meetups are under **`/events*`** and the catalog under
> **`/activity-types*`** (this supersedes the earlier `/activities` sketch).
>
> **Going live:** set `VITE_API_URL` (see `.env.example`) and use the live implementations in
> `src/api/remote.ts` (built on `src/api/http.ts`, which adds the JWT header + refresh-on-401).
> Leaving `VITE_API_URL` blank keeps the offline in-memory mock (`src/api/store.ts`).
> The NestJS serializers return the same field shapes as the frontend TS types, so components
> don't change.

## Auth & profile

| Function | Method & path | Notes |
|---|---|---|
| `signup(input)` | `POST /auth/signup` | **Active immediately** — no SMS, no approval. |
| `login(creds)` | `POST /auth/login` | Email+password or mocked Google. |
| `getCurrentUser()` | `GET /auth/me` | Lapses expired suspensions. |
| `updateProfile(patch)` | `PATCH /users/me` | |

## Activities (meetups)

| Function | Method & path | Notes |
|---|---|---|
| `listEvents(filters, {sort,zip})` | `GET /events?filter=&sort=distance&zip=` | Excludes cancelled/completed. |
| `listPreviewEvents(limit)` | `GET /events?limit=` | Public, read-only (landing page). |
| `getEvent(id)` | `GET /events/:id` | |
| `createEvent(input)` | `POST /events` | **Live immediately.** Enforces >4h-from-now + public-place confirmation. |
| `joinEvent(id, share?)` | `POST /events/:id/join` | Checks account active; waitlists when full. `share` = §7 opt-in (`shareContactWithHostBusiness`, default false). |
| `leaveEvent(id, userId)` | `DELETE /events/:id/join` | Promotes first waitlisted. |
| `startActivity(id, note)` | `POST /events/:id/start` | Host only, ≤30 min before start. |
| `createCustomActivity(input)` | `POST /activity-types` | Custom catalog entry. |
| `listActivities()` | `GET /activity-types` | |
| `getConditions(spotId)` | `GET /spots/:id/conditions` | Outdoor only. |

## Group chat

| Function | Method & path | Notes |
|---|---|---|
| `listThreads(userId)` | `GET /chats` | Hides threads expired 24h after the activity ended. |
| `getThread(id)` | `GET /events/:id/chat` | |
| `sendMessage(threadId, text)` | `POST /events/:id/chat/messages` | Rejected on expired chat / blocked account. |

## Ratings, reviews & reports

| Function | Method & path | Notes |
|---|---|---|
| `submitRating(input)` | `POST /events/:id/ratings` | Private; recomputes trust score + flags. |
| `getRateablePeople(eventId)` | `GET /events/:id/ratings/pending` | Who you still owe a rating. |
| `reportTarget(input)` | `POST /reports` | From chat, event, or profile. |

## Admin (reactive only — no approval queues)

| Function | Method & path | Notes |
|---|---|---|
| `adminOverview()` | `GET /admin/overview` | Open reports / flagged users / live today. |
| `listReports()` | `GET /admin/reports` | Includes linked chat log. |
| `listFlaggedUsers()` | `GET /admin/flagged-users` | trust < 2.5, ≥2 flags, or ≥2 reports. |
| `resolveReport(id)` | `POST /admin/reports/:id/resolve` | |
| `warnUser(id)` | `POST /admin/users/:id/warn` | |
| `suspendUser(id, days)` | `POST /admin/users/:id/suspend` | Default 7 days. |
| `banUser(id)` | `POST /admin/users/:id/ban` | |

All admin functions assert `role === 'admin'` (mock; the seed admin is user **u1 / "You"**).

## Business side (Foundation)

A **Business** is its own organization; people belong to it via **BusinessMember** roles
(`OWNER ⊇ MANAGER ⊇ STAFF`). Auth stays person-based — belonging to a business unlocks
"business mode". Role-gated routes use `BusinessRoleGuard`.

| Function | Method & path | Notes |
|---|---|---|
| `createBusinessOrg(input)` | `POST /businesses` | Caller becomes OWNER; status `PENDING_VERIFICATION`. Requires `acceptBusinessTos`. |
| `getMyBusinesses()` | `GET /me/businesses` | Businesses the caller belongs to (context switch). |
| `getBusinessOrg(id)` | `GET /businesses/:id` | Public profile (verified badge + venues). |
| `updateBusinessOrg(id, patch)` | `PATCH /businesses/:id` | MANAGER+. |
| `submitBusinessVerification(id, input)` | `POST /businesses/:id/verification` | OWNER. Multipart RC/ICE + documents. |
| `inviteBusinessMember(id, email, role)` | `POST /businesses/:id/members/invite` | OWNER. Email must have an account. |
| `acceptBusinessInvite(businessId)` | `POST /businesses/members/accept` | Invitee accepts. |
| `updateBusinessMemberRole(id, userId, role)` | `PATCH /businesses/:id/members/:userId` | OWNER. |
| `removeBusinessMember(id, userId)` | `DELETE /businesses/:id/members/:userId` | OWNER. |
| `listVenues(filters)` | `GET /venues?category=&q=&lat=&lng=&radiusKm=` | Public browse/search. |
| `getVenue(id)` | `GET /venues/:id` | Profile + upcoming events + visible reviews. |
| `createVenue(input)` | `POST /venues` | MANAGER+ (businessId in body). |
| `updateVenue(id, patch)` | `PATCH /venues/:id` | MANAGER+ of the venue's business. |
| `claimVenue(id, businessId, evidence?)` | `POST /venues/:id/claim` | MANAGER+. Unclaimed venues only; one active claim. |
| `submitVenueReview(id, rating, text?)` | `POST /venues/:id/reviews` | Must have attended an event held at the venue. |

### Admin moderation (business surface)

| Function | Method & path | Notes |
|---|---|---|
| `listBusinessVerificationsAdmin()` | `GET /admin/business-verifications` | Pending RC/ICE submissions. |
| `approveBusinessVerification(id)` | `POST /admin/business-verifications/:id/approve` | → Business `VERIFIED`. |
| `rejectBusinessVerification(id, note?)` | `POST /admin/business-verifications/:id/reject` | → Business `REJECTED`. |
| `listVenueClaimsAdmin()` | `GET /admin/venue-claims` | Pending venue claims. |
| `approveVenueClaim(id)` | `POST /admin/venue-claims/:id/approve` | Links venue to business (`CLAIMED`/`VERIFIED`). |
| `rejectVenueClaim(id, note?)` | `POST /admin/venue-claims/:id/reject` | |
| _(no fn)_ | `POST /admin/venue-reviews/:id/flag` · `/remove` | Review moderation. |

### §7 Attendee-data privacy boundary (CNDP)

Businesses **never** receive attendee names/emails/phones by default. There is **no**
business-facing attendee endpoint in this phase; business reads are counts/aggregates only.
Each attendance carries `shareContactWithHostBusiness` (default **false**) — set via the
join opt-in — so a future business dashboard can expose **only** the contacts of attendees
who explicitly consented. `GET /events/:id/attendees` is person-facing social data (the same
avatars/names already shown publicly), never scoped to a business context.

## Notifications & dev

| Function | Method & path | Notes |
|---|---|---|
| `listNotifications()` | `GET /notifications` | |
| `markNotificationsRead()` | `POST /notifications/read` | |
| `devTriggerLifecycle(phase)` | _dev only_ | Simulates reminders / start / completion so the time-based flows are testable without waiting. Not a real endpoint. |
