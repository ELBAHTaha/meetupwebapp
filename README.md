# Jmaâ 🇲🇦

> _Jemaa_ — "gathering / assembly". **The app for when you're bored and want to meet people
> in Morocco.** Locals beat boredom and make friends; travelers find instant plans and company.
> Activities — coffee, padel, surf, board games, hikes, language exchange, anything — are the
> vehicle for connection. Friends and activities are framed equally.

> **v0.2 — calm, photo-led redesign.** The visual language was rebuilt from scratch: warm,
> earthy Moroccan tones, an editorial Fraunces/Inter pairing, photography-led cards, hairline
> borders over heavy shadows, line icons (no emoji in chrome), and restraint over decoration.
> See **Design system** below.

This is a **frontend-only** build with a clean mock-data layer. There is no backend — all
data lives in an in-memory store seeded with realistic Moroccan content. The API module is
designed as the single seam to replace with a real REST backend later.

## Run it

```bash
npm install
npm run dev
```

Open the printed local URL (default http://localhost:5173). On a phone-sized viewport you get
the bottom tab bar; on desktop a centered shell with a top nav.

Other scripts:

```bash
npm run build     # typecheck (tsc --noEmit) + production build
npm run preview   # preview the production build
npm run lint      # type-only check
```

> **Demo auth:** login/signup accept anything. "Sign up" collects the new profile fields then
> runs onboarding (here-for → city → activities → levels → traveler?). "Log in" drops you straight
> in as the seeded demo user **"You"** (Casablanca). That user is also the seeded **admin**, so
> **/admin** is reachable and the **Settings → Admin panel** entry appears. A floating **Dev**
> button (bottom-left) fast-forwards the reminder / start / rating lifecycle without waiting.
> The seed includes a flagged + reported user (**Tom**) and a just-ended activity so ratings,
> flagging, and chat-expiry are immediately demoable.

## Tech stack

| Concern        | Choice                                            |
| -------------- | ------------------------------------------------- |
| Build / app    | Vite + React 18 + TypeScript                      |
| Styling        | Tailwind CSS (theme tokens in `tailwind.config.js`) |
| Routing        | React Router                                      |
| State          | Zustand (`session`, `toast`)                      |
| Maps           | react-leaflet + OpenStreetMap (CARTO **Positron** tiles, **no API key**) |
| i18n           | react-i18next — EN + FR populated, AR (Darija) stub |
| Icons          | lucide-react line icons (1.5px stroke; no emoji in chrome) |
| Imagery        | curated `images.unsplash.com` URLs via `src/lib/imagery.ts` |
| Dates          | date-fns                                          |

## Design system (v0.2)

All tokens live in `tailwind.config.js`. Neutrals do ~85% of the work; **clay is the only
color on primary actions** and no view shows more than two accent colors.

**Color** — `bg #FBF8F2` (warm bone canvas) · `surface #FFF` · `surface-sunk #F3EDE2` ·
`border #E7DFD2` · `ink #2B2620` / `ink-soft #6F6557` / `ink-faint #9C9384` ·
**`clay #C2502E` (primary)** · `olive #5F6342` (secondary) · `saffron #D89A34` (ratings/badges) ·
`majorelle #2E5A87` (rare jewel/links). Status colors derive from olive/saffron/clay.

**Type** — `Fraunces` (serif) for display/headings, `Inter` for body/UI. ~6 sizes
(`display 36 / h1 26 / h2 20 / h3 17 / base 16 / meta 13`).

**Shape & elevation** — varied radii (`image/card 12px`, `input 10px`, pills full,
`sheet 20px`); hairline `border` + whitespace preferred over shadows, with one subtle `shadow-e1`
token for sheets/popovers.

**Imagery** — `src/lib/imagery.ts` maps every activity, group and seed spot to a warm Unsplash
photo (standardized 3:2, `object-cover`, lazy, optional bottom-up scrim). `<SmartImage>`
degrades gracefully to a tonal block + line icon if any URL fails, so the UI never shows a
broken image. The activity-color system (`src/lib/activityColors.ts`) is a muted 3-tone family
(clay = sport, olive = outdoor, majorelle = social).

**Motion** — 150–250ms ease-out; image hover = gentle 1.03 zoom; sheets slide; no bounce.
`prefers-reduced-motion` is respected.

## What's built

**Auth & onboarding** — landing/hero, mocked login & signup, 4-step onboarding.
**Discover** — personalized feed (ordering tuned by `lookingFor`), search, **intent-collection
rail** ("Free tonight", "Coffee & conversation", "Get moving", "New in town", "Travelers
welcome", "Chill & social"), photo-led card grid, filter sheet (type, vibe, date, skill,
open-spots-only, travelers-welcome), city switcher.
**Map** — all city events as activity-colored Leaflet pins, tap → mini card, list/map toggle.
**Create event** — 5-step flow: pick activity **or create a custom one**, place (saved spot
or tap-the-map point), date/time/duration, details (capacity, **minimum players**, skill,
price, description, travelers, visibility), review & publish.
**Event detail** — full info, live conditions widget for outdoor events, host card, who's
going + waitlist, embedded map, RSVP button with full state logic, group-chat link, share,
report.
**Chat** — event group chats + DMs, message bubbles with optimistic send.
**Profile** — own & other-user profiles, activities + levels, badges, ratings/reviews,
hosting/going/past tabs, edit profile, settings (language switcher EN/FR/Darija).
**Secondary** — notifications, 404, skeletons & playful empty states throughout.

### Product & schema additions (v0.2)

- **Expanded catalog** — alongside sport/outdoor activities there's a **Social & chill** group
  (coffee, board games, language exchange, co-working, city walks, dinner, book club, live music,
  art, volunteering, photo walks), each with seeded events and photos. "Create your own activity"
  is retained (now with a line-icon picker, type and vibe).
- **Type extensions** (non-breaking, in `src/types/`): `Activity` gains `group`
  (`'sport' | 'outdoor' | 'social'`) and `vibe` (`'chill' | 'active'`); `Event` gains an optional
  `vibe`; `User` gains `lookingFor` (`'partners' | 'friends' | 'both'`). The granular
  `category` field is preserved; `group` is the new high-level axis. `EventFilters` gains
  `group`/`vibe`/`collection`.
- **Onboarding** adds a "What are you here for?" step feeding `lookingFor`, which personalizes
  Discover copy and ordering.

### Trust, lifecycle & moderation (v0.3)

This build adds the social-safety layer — **de-gated** (no SMS, no approval queues):

- **Signup** collects name, email/password **or** mocked Google, required **profile photo**
  (local-preview stub; face checks deferred to backend), neighborhood + ZIP, a **client-side
  18+ check**, and optional unverified **phone**. Accounts are **active immediately**.
- **Landing** leads with "Meet locals IRL", a **read-only preview** of live activities (cards
  prompt sign-up), and **Join an activity / Host an activity** CTAs.
- **Hosting goes live instantly** — no pending state. The form enforces: title ≤ 60 chars,
  capacity **2–12**, **starts > 4 h from now** (no same-day), optional **gender preference**,
  and a required **"public place" confirmation** with a soft private-home keyword warning.
- **Joining** checks the account is active (suspended/banned are blocked) and shows a
  "Meeting at X, Sat 2pm — see you there!" confirmation. Waitlist/team-minimum logic is unchanged.
- **Activity lifecycle** (simulated client-side, surfaced as in-app notifications): day-before
  reminders, a host **"Start activity"** action (enabled 30 min before; prompts a "how to spot
  me" note → attendees notified), and a post-event **private rating** flow (host↔attendee, 1–5).
  A floating **Dev** panel fast-forwards reminders / start / completion so every flow is testable
  without waiting.
- **Trust score** = average of received private ratings (default 5.0), shown subtly on profiles.
  A 1–2★ rating **flags** the user; **≥2 flags from different activities** (or trust < 2.5, or
  ≥2 reports) surfaces them in the admin **Flagged** list.
- **Reporting** from the group chat, event page, or a profile captures a reason + linked chat log.
- **Group chats** are attendees-only and **auto-expire 24 h after the activity ends**
  (`expiresAt = endsAt + 24h`) — expired threads are hidden and the composer is disabled.
- **Reactive `/admin`** (role-gated; seed admin is **u1 / "You"**, non-admins redirected):
  overview counts, a **Reports** tab (with chat-log viewer + resolve) and a **Flagged** tab
  (**Warn / Suspend 7 days / Ban**). No approval tabs. Suspensions auto-lapse.

> **Data model:** `User` gains `status` (`active|suspended|banned`), `role`, `trustScore`,
> `flagCount`, `neighborhood/zip/birthday/phone?`. The meetup (`JmaaEvent`) keeps its RSVP
> `status` machine and adds a separate **`lifecycle`** (`live|completed|cancelled`),
> `genderPreference`, `endsAt`, `startedAt`, `hostSpotNote`. New `Rating` and `Report` entities;
> `ChatThread` gains `expiresAt`. New fields are normalized at store-load so the existing seed
> literals stay valid. See **`src/api/ENDPOINTS.md`** for the full REST mapping.

### Core feature logic

- **RSVP states:** `not_joined → joined → waitlisted → host → past`. Joining decrements open
  spots; leaving frees a spot and **promotes the first waitlisted person**.
- **Team-sport minimums:** events stay `PENDING` until `minPlayers` is reached, then flip to
  `CONFIRMED`. Cards and detail show _"Needs N more to confirm"_ — the killer mechanic for
  football/padel.
- **Capacity & waitlist:** when full, new joiners are waitlisted with their position shown.
- **Custom activities** persist in the store and immediately appear in the catalog & filters.
- **Conditions** (swell/wind/temp/water) surface only for outdoor/weather-dependent activities.
- **Travelers-welcome** flag is both a card badge and a Discover filter.
- **Trust & safety (UI):** verified badges, post-event reviews, report button, public meeting
  point on the map.

## Project structure

```
src/
  api/         # mock API + in-memory store + seed data + activity catalog
  components/  # reusable UI primitives (Button, Chip, EventCard, MapView, …)
  features/    # feature folders: auth, discover, map, event, create, chat, profile, …
  hooks/       # useAsync
  store/       # zustand stores (session, toast)
  i18n/        # react-i18next config + en/fr/ar JSON
  routes/      # router config
  types/       # shared TS types
  lib/         # helpers (format, distance, classnames, activity colors)
  styles/      # tailwind entry + base styles
```

## Swapping in a real backend

`src/api/index.ts` is the **single seam**. Every exported function (`listEvents`, `getEvent`,
`createEvent`, `joinEvent`, `leaveEvent`, `createCustomActivity`, `getConditions`,
`listThreads`, `sendMessage`, `login`, `getCurrentUser`, …) returns a `Promise` and maps 1:1
to a future REST endpoint. Replace the bodies (which read/write `src/api/store.ts`) with real
`fetch` calls and the UI keeps working unchanged. The TypeScript types in `src/types/` already
mirror the intended API payloads.

## Notes

- RTL isn't wired up yet, but strings go through `t()` and layout avoids hardcoded direction so
  it won't block an Arabic RTL pass later.
- The mock store is session-scoped (resets on reload); only auth/onboarding/city/language
  persist via `localStorage`.
#   m e e t u p w e b a p p  
 