# hudlgo 🇲🇦

**hudlgo** is a Morocco-first app for meeting people through real-life activities: coffee,
padel, surf, board games, hikes, language exchange and more. Bored locals and travellers find
or host a small activity, join it, and chat with the group. It's a two-sided marketplace:
consumers on one side, venues/businesses on the other (venue sponsorships, coupons).

Live at **https://hudlgo.com**.

| | |
|---|---|
| **Frontend** | Vite · React 18 · TypeScript · Tailwind · Zustand · react-i18next (EN / FR / AR with RTL) · react-leaflet · socket.io-client |
| **Backend** | NestJS 10 · Prisma 5 · MySQL 8 · JWT + Google OAuth · socket.io · @nestjs/schedule · sharp · Resend (email) |
| **Infra** | One VPS running Docker Compose (api + mysql + Caddy) behind Traefik. Free tiers only. |

- 📐 **[ARCHITECTURE.md](ARCHITECTURE.md)**: data model, modules, domain flows, monetization.
- 🚀 **[DEPLOY.md](DEPLOY.md)**: production setup, email (Resend), backups, manual payments.
- 🔌 **[server/README.md](server/README.md)**: backend details and API surface (Swagger at `/docs`).

---

## Repository layout

```
.
├─ src/                 # frontend (React)
│  ├─ api/              # the API seam: mock.ts (offline) ↔ remote.ts (real backend), http.ts
│  ├─ features/         # pages: auth, discover, create, event, chat, profile, business, admin, …
│  ├─ components/       # shared UI
│  ├─ lib/ hooks/ store/ i18n/ types/
├─ server/              # backend (NestJS) — prisma/schema.prisma, src/<module>/, test/ (e2e)
├─ scripts/             # backup.sh / restore.sh for the VPS
├─ docker-compose.prod.yml, docker-compose.traefik.yml, Caddyfile*, Dockerfile.web
└─ deploy.sh            # used by the GitHub Actions deploy on push to main
```

## Run it locally

### 1. Frontend only (offline mock)

```bash
npm install
npm run dev                  # http://localhost:5173
```

Without `VITE_API_URL`, everything runs on an in-memory mock seeded with Moroccan demo data.
Login accepts anything and makes you the demo user (also an admin). No backend is needed.

### 2. Full stack (real backend)

```bash
# Database: MySQL 8 in Docker on :3307 (user jmaa / jmaa, root / root)
docker compose -f server/docker-compose.yml up -d mysql

# Backend
cd server
cp .env.example .env         # point DATABASE_URL at the DB above
npm install
npx prisma migrate deploy
npm run seed                 # ⚠️ demo data, wipes tables — never on production
npm run start:dev            # http://localhost:4000 · Swagger /docs · socket.io /socket.io

# Frontend (from the repo root)
echo "VITE_API_URL=http://localhost:4000" > .env
npm run dev
```

Seeded logins (password `password123`): admin `you@jmaa.app`, user `lena@jmaa.app`, business
`venue@jmaa.app`. With the placeholder `RESEND_API_KEY=re_xxx`, emails are printed to the API
console instead of sent. That includes the email-verification and password-reset links.

## Scripts

| Where | Command | What it does |
|---|---|---|
| root | `npm run dev` / `build` / `preview` | Vite dev server / typecheck + production build / preview |
| root | `npm run lint` | Type check (`tsc --noEmit`) |
| server | `npm run start:dev` | Nest in watch mode |
| server | `npm run build` / `start:prod` | Compile / run `dist/main.js` |
| server | `npm run lint` | Type check |
| server | `npm run seed` | Demo seed (destructive). Production uses `seed.prod` automatically. |
| server | `npm run test:e2e` | End-to-end tests (need a migrated + seeded MySQL in `DATABASE_URL`) |
| server | `npx prisma migrate deploy` | Apply migrations (additive only — never edit `0_init`) |

## Environment variables

**Frontend** (`.env`, baked in at build time):

| Var | Purpose |
|---|---|
| `VITE_API_URL` | Backend base URL. Leave it empty to run on the offline mock. |
| `VITE_TURNSTILE_SITE_KEY` | Optional Cloudflare Turnstile CAPTCHA on signup |

**Backend** (`server/.env`, production `.env.prod`; see the `.example` files):

| Var | Purpose |
|---|---|
| `DATABASE_URL` | MySQL connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_*_TTL` | Auth tokens |
| `FRONTEND_URL` | CORS allow-list for REST and WebSockets (comma-separated) |
| `APP_URL` | Frontend base URL used in email links |
| `PUBLIC_URL`, `UPLOADS_DIR` | Public API URL (upload links) and the upload folder |
| `RESEND_API_KEY`, `MAIL_FROM` | Email via Resend (`re_xxx` logs emails instead of sending them) |
| `PAYMENT_INSTRUCTIONS_EN` / `_FR` / `_AR` | Offline-payment instructions shown with upgrade requests |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_CALLBACK_URL` | Optional Google sign-in |
| `TURNSTILE_SECRET_KEY` | Optional CAPTCHA verification |
| `THROTTLE_TTL`, `THROTTLE_LIMIT` | Global rate limit |
| `RCLONE_REMOTE` *(VPS only)* | Optional off-site backup target for `scripts/backup.sh` |

## Key ideas

- **One API seam.** `src/api/index.ts` exposes `{ ...mock, ...remote }`. Every network
  function must exist in **both** `mock.ts` and `remote.ts`, or production silently shows mock
  data. The only intentional mock-only exports are `canStart` (a pure helper) and
  `devTriggerLifecycle` (dev panel).
- **Accounts & safety:** email verification (required to host, join or chat), password reset,
  identity selfie verification, private ratings → trust score, reports, blocking, and admin
  moderation.
- **Real-time chat:** socket.io rooms per activity. REST stays the only write path.
- **Payments are offline.** Customers request an upgrade and pay by bank transfer, CashPlus or
  cash using a reference code. An admin activates the plan. There is no payment gateway and no
  auto-renewal (see ARCHITECTURE §6).
- **Uploads** stay on the VPS disk, validated and re-encoded to WebP with metadata stripped.
  Daily backups can be copied off-site to Google Drive (DEPLOY §9).
- **i18n:** every user-facing string goes through `t()` with keys in `src/i18n/{en,fr,ar}.json`.
  Arabic is right-to-left (logical Tailwind classes: `ms-`/`pe-`/`start-`/`text-start`…).

## Deploying

A push to `main` deploys to production through `.github/workflows/deploy.yml` → `deploy.sh`.
Work on a branch and merge only when it's ready to ship. See [DEPLOY.md](DEPLOY.md).
