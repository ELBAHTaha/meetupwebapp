# Deploying Jmaâ to production

A single-VPS, Docker-based deployment for a **soft launch** (payments run in
dev-simulation — no real charges). Three containers behind one Caddy edge with
automatic HTTPS:

```
                         ┌──────────────────────────────────────┐
  https://DOMAIN  ─────▶ │  web (Caddy)  serves the built SPA    │
  https://api.DOMAIN ──▶ │               reverse-proxies ─────┐  │
                         └────────────────────────────────────┼──┘
                                          ┌────────────────────▼─────┐
                                          │  api (NestJS, :4000)      │
                                          └────────────┬─────────────┘
                                                       │
                                          ┌────────────▼─────────────┐
                                          │  mysql (8.0, volume)      │
                                          └──────────────────────────┘
```

Everything is driven by `docker-compose.prod.yml` + `.env.prod`.

---

## 1. Prerequisites

- A VPS (Hetzner CX22, DigitalOcean basic droplet, etc. — 2 GB RAM is plenty to
  start). **Ubuntu 22.04/24.04** assumed below.
- Your **domain**, with DNS you can edit.
- Ports **80** and **443** open to the internet (and **22** for SSH).

## 2. DNS

Point these records at your VPS's public IP (`A` records):

| Type | Name  | Value          |
|------|-------|----------------|
| A    | `@`   | `<VPS_IP>`     |
| A    | `www` | `<VPS_IP>`     |
| A    | `api` | `<VPS_IP>`     |

Caddy provisions Let's Encrypt certificates automatically once these resolve, so
set them up **before** the first `up`. (DNS can take a few minutes to propagate.)

## 3. Install Docker on the VPS

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # then log out / back in so `docker` works without sudo
docker --version && docker compose version
```

## 4. Get the code onto the VPS

```bash
git clone <your-repo-url> jmaa && cd jmaa
# (or: scp/rsync this folder up if the repo isn't pushed anywhere)
```

## 5. Configure secrets

```bash
cp .env.prod.example .env.prod

# Generate strong secrets:
openssl rand -hex 32   # → JWT_ACCESS_SECRET
openssl rand -hex 32   # → JWT_REFRESH_SECRET
openssl rand -hex 24   # → MYSQL_PASSWORD / MYSQL_ROOT_PASSWORD / ADMIN_PASSWORD

nano .env.prod         # fill in DOMAIN + all the CHANGE_ME values
```

Minimum to set: `DOMAIN`, the three MySQL passwords, both JWT secrets, and
`ADMIN_EMAIL` / `ADMIN_PASSWORD`. Email is optional for launch (see §8).

## 6. Launch

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

First build takes a few minutes. On boot the api container runs
`prisma migrate deploy` (creates all tables) then `seed.prod` (loads the activity
catalog and your admin account — **no demo data, no deletes**).

Watch it come up:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f
```

## 7. Verify

- `https://api.DOMAIN/docs` → Swagger UI loads (API is up).
- `https://DOMAIN` → the app loads; sign-up / login work.
- Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` → the **Admin** link appears in the
  top nav; you can approve activities and moderate.

> Note: until you have real users, the discover feed will be empty (the demo seed
> is intentionally **not** used in production). Create a couple of activities from
> your admin/host account to populate it for early users.

## 8. Email (recommended before real users)

Without a real email provider, password-reset and verification emails only print
to the container log — users can't recover accounts. To enable real email:

1. Create a [Resend](https://resend.com) account and **verify your domain**.
2. Set `RESEND_API_KEY=re_...` and `MAIL_FROM="Jmaa <noreply@DOMAIN>"` in `.env.prod`.
3. `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d` (recreates api).

## 9. Day-2 operations

**Update / redeploy after code changes**
```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```
Migrations are applied automatically on boot. The prod seed is idempotent and
never deletes data, so redeploys are safe.

**Database backup** (do this on a schedule — e.g. cron daily)
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec mysql \
  sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > backup-$(date +%F).sql
```

**Restore**
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T mysql \
  sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < backup-YYYY-MM-DD.sql
```

**Logs / status / stop**
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f api
docker compose -f docker-compose.prod.yml --env-file .env.prod down   # stop (keeps volumes/data)
```

Persistent data lives in named volumes: `mysql_data` (DB), `uploads` (user photos),
`caddy_data` (TLS certs). `down` keeps them; `down -v` **deletes** them — don't.

## 10. Going live with payments later

This deployment runs Paddle in **dev-simulation** (orders are marked paid
without charging). When you're ready to charge real money:

1. In the **Paddle dashboard**, create the products + prices and copy each price id:
   Pro Host (recurring), the business sponsorships (one recurring price per
   tier × billing term), and the one-off pinned-extra price.
2. Get a **production** Paddle API key and a webhook **signing secret**, and a
   client-side **token** for Paddle.js.
3. Add to `.env.prod` and to the `api` service env in `docker-compose.prod.yml`:
   `PADDLE_API_KEY`, `PADDLE_ENVIRONMENT=production`, `PADDLE_WEBHOOK_SECRET`, and
   the `PADDLE_*_PRICE_ID` vars. Bake `VITE_PADDLE_CLIENT_TOKEN` (+ `VITE_PADDLE_ENV`)
   into the web build.
4. Add a Paddle **notification destination** (webhook) pointed at
   `https://api.DOMAIN/payments/paddle/webhook`, subscribed to
   `transaction.completed`, `subscription.canceled`, and `transaction.payment_failed`.
5. Paddle is the **merchant of record** — no card data touches your servers (no
   PCI-DSS SAQ-D scope); Paddle also handles VAT/tax.

---

### Notes & optional hardening

- **Single-origin CORS**: the API only allows `https://DOMAIN`. `www` redirects to
  the apex before the app loads, so this is fine.
- **Swagger** (`/docs`) is publicly reachable. Harmless, but you can gate or
  disable it in `server/src/main.ts` for production if you prefer.
- **Firewall**: `ufw allow 22,80,443/tcp` and deny the rest. MySQL and the API are
  not published to the host — only Caddy is exposed.
- **Bundle size**: the SPA ships as one ~840 KB JS chunk (gzip ~240 KB). Fine for
  launch; code-split later if you want faster first paint.
