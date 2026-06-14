# Jmaâ — Backend (NestJS + Prisma + MySQL)

REST API for the Jmaâ Morocco activity/meetup app. Matches the frontend's data shapes and the
product rules: **no SMS / no approval gating** (accounts active on signup, events live on
creation), 18+ only, public places only, join/waitlist + team minimums, group chats that expire
24h after an event, **private** ratings → trust score → flagging, reporting, and a **reactive**
admin panel (warn/suspend/ban). No Firebase.

- **Stack:** NestJS 10 · Prisma 5 · MySQL 8 · JWT (access + rotating, hashed refresh) · bcrypt ·
  Passport Google OAuth (optional) · class-validator · Swagger · @nestjs/schedule · Throttler ·
  Helmet · Multer (local disk via a swappable `StorageService`).
- **Docs:** Swagger UI at **`/docs`**, health at **`/health`**.

---

## Quick start (Docker — everything)

```bash
cd server
cp .env.example .env          # tweak secrets if you like
docker compose up --build
```

This starts MySQL + the API, runs `prisma migrate deploy`, seeds the database, and serves on
**http://localhost:4000** (`/docs` for Swagger). Re-running is safe — the seed upserts.

## Quick start (local Node + Dockerised MySQL)

```bash
cd server
cp .env.example .env
docker compose up -d mysql     # just the database
npm install
npm run prisma:generate
npm run prisma:migrate         # or: npm run prisma:deploy
npm run seed
npm run start:dev
```

The seed prints the admin login:

```
Admin login →  email: you@jmaa.app   password: password123
All seed users share the password: password123
```

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run start:dev` | Watch-mode dev server |
| `npm run build` / `npm run start:prod` | Compile to `dist/` and run |
| `npm run lint` | `tsc --noEmit` typecheck |
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:migrate` | Create + apply a dev migration |
| `npm run prisma:deploy` | Apply committed migrations (prod) |
| `npm run seed` | Seed catalog + users + events + ratings/reports |
| `npm run test:e2e` | Smoke e2e (needs a seeded DB) |

## Environment (`.env`)

| Var | Notes |
|---|---|
| `DATABASE_URL` | `mysql://user:pass@host:3306/jmaa` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | **Set strong values in prod.** |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | e.g. `900s` / `30d` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional — Google sign-in is skipped if absent |
| `GOOGLE_CALLBACK_URL` | Defaults to `…/auth/google/callback` |
| `FRONTEND_URL` | CORS origin |
| `PUBLIC_URL` | Base for building uploaded-photo URLs |
| `UPLOADS_DIR` | Local upload dir (served at `/uploads`) |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | Rate limit window (ms) / requests |

---

## API surface (Swagger documents every DTO)

```
POST   /auth/signup            (multipart photo + JSON; 18+; ACTIVE immediately)
POST   /auth/login             GET /auth/me            POST /auth/refresh   POST /auth/logout
GET    /auth/google            GET /auth/google/callback     (optional)

GET    /users/:id              PATCH /users/me
GET    /users/me/notifications  PATCH /users/me/notifications/:id/read   …/read-all

GET    /activity-types         POST /activity-types          (custom)

GET    /events?when=&typeId=&category=&vibe=&skillLevel=&openOnly=&travelersWelcome=&sort=distance&zip=&lat=&lng=
GET    /events/:id             GET /events/:id/attendees
POST   /events                 (LIVE immediately; >4h & not same-day; public-place only)
PATCH  /events/:id             POST /events/:id/cancel       POST /events/:id/start
POST   /events/:id/join        DELETE /events/:id/join

GET    /events/:id/chat        POST /events/:id/chat/messages   (attendees only; 410 when expired)
POST   /events/:id/ratings     GET  /events/:id/ratings/pending  (private; after end)
POST   /reports

GET    /admin/overview         GET /admin/flagged-users      GET /admin/reports
PATCH  /admin/reports/:id/resolve
POST   /admin/users/:id/warn   /suspend   /ban
GET    /health
```

### Key rules enforced server-side
- **Signup:** 18+ from `birthday` (422 otherwise); ZIP→approx lat/lng via `GeocodingService`
  (static city table seam); account `ACTIVE` immediately.
- **Create event:** `startsAt` > now + 4h **and** not the same calendar day; `endsAt > startsAt`;
  `2 ≤ maxAttendees ≤ 12`; `title ≤ 60`; `isPublicPlace === true`; private-home keyword check
  (422). Auto-creates the group chat with `expiresAt = endsAt + 24h`.
- **Join:** account active; not already joined; gender matches `genderPreference`; waitlists when
  full and **promotes the first waitlisted** on leave.
- **Ratings:** only after `endsAt`, only by participants, unique per (event, rater, ratee).
  Recomputes the ratee's `trustScore`; a 1–2★ creates a `Flag`. Flagged = trust < 2.5, flags from
  ≥2 distinct events, or ≥2 reports.
- **Scheduler:** every 5 min completes ended events + sends rating prompts; hourly sends
  day-before reminders and clears lapsed suspensions; nightly prunes very old chat messages.

---

## Deploying (managed MySQL)

The image is a standard multi-stage Node build. On any host (Railway / Render / Fly.io):

1. **Provision MySQL 8** (Railway/PlanetScale/Render add-on) and copy its connection string into
   `DATABASE_URL`.
2. Set env: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `PUBLIC_URL`, and optional
   `GOOGLE_*`.
3. **Release/start command:**
   ```bash
   npx prisma migrate deploy && node dist/main.js
   ```
   (Run `npm run seed` once if you want demo data.)

**Railway:** New Project → Deploy from repo (root = `server/`) → add a MySQL plugin → set the
release command above. **Render:** Web Service (Docker) + a MySQL instance; Pre-Deploy Command
`npx prisma migrate deploy`. **Fly.io:** `fly launch` (Dockerfile detected) + a MySQL app or
external DB; run `fly deploy` then `fly ssh console -C "npx prisma migrate deploy"`.

> Uploads are local disk by default (`/uploads`, mounted to a volume in compose). For multi-instance
> deploys, implement an S3 driver behind `StorageService` and point `PUBLIC_URL` at the bucket/CDN.

---

## Frontend wiring

The React app (repo root) talks to this API via `src/api/http.ts` + `src/api/remote.ts`, activated
by setting **`VITE_API_URL`** (see the root `.env.example`). The serializers here return the exact
field shapes the frontend types expect, and the canonical paths (`/events*`, `/activity-types*`)
are documented in the frontend's `src/api/ENDPOINTS.md`. With `VITE_API_URL` unset the frontend
runs entirely on its in-memory mock.

## Project layout

```
server/src/
  common/      decorators, guards, filters, dto, utils, serializers
  config/      typed configuration
  prisma/      PrismaService (+ schema & seed in prisma/)
  storage/     StorageService (local disk; S3-ready seam)
  geocoding/   GeocodingService (static ZIP→city; provider seam)
  notifications/  in-app notifications
  auth/ users/ activity-types/ events/ chat/ ratings/ reports/ admin/  feature modules
  scheduler/   cron jobs (lifecycle, reminders, suspension lapse)
```

> **Future:** chat is polling-friendly REST today; upgrade to `@nestjs/websockets` (Socket.IO) for
> realtime without changing the access/expiry rules.
