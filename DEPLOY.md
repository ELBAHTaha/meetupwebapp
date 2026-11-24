# Deploying Jmaâ to production

A single-VPS, Docker-based deployment. Paid plans are paid **offline** and
activated by an admin (no payment gateway — see §10). Three containers behind one
Caddy edge with automatic HTTPS:

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
catalog, your admin account, and a set of **community starter activities** — four
per city so the discover feed is populated from day one. **No deletes.**).

Watch it come up:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f
```

## 7. Verify

- `https://api.DOMAIN/docs` → Swagger UI loads (API is up).
- `https://DOMAIN` → the app loads; sign-up / login work.
- Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` → the **Admin** link appears in the
  top nav; you can approve activities and moderate.

> Note: the discover feed is pre-populated with community starter activities (four
> per known city, hosted by verified `*.community@hudlgo.com` accounts) so early
> users never see an empty feed. They refresh automatically on each boot — expired
> ones are replaced, live ones (and any real joins) are left untouched. The full
> demo seed (`seed.ts`) is still intentionally **not** used in production.

## 8. Email with Resend (free tier, required before real users)

hudlgo sends password-reset links, email-verification links, password-changed
notices, plan-renewal reminders and notification mirrors. Without a real email
provider these only print to the api container log (`[mail:dev] … link for …`),
so **new users can't verify their email and nobody can reset a password**.

[Resend](https://resend.com)'s **free tier** (3,000 emails/month, 100/day, one
domain) is plenty for launch.

1. **Create an account** at <https://resend.com/signup> (no card needed).
2. **Add the domain**: *Domains → Add domain* → enter `hudlgo.com`. Pick the region
   closest to your users (EU – Ireland is fine for Morocco).
3. **Add the DNS records Resend shows you** at your DNS host (Cloudflare for
   hudlgo.com → *DNS → Records → Add record*). Resend lists the exact values;
   typically:

   | Type | Name | Value (copy from Resend) | Purpose |
   |------|------|--------------------------|---------|
   | TXT  | `resend._domainkey` | `p=MIGfMA0GCSq…` (long DKIM key) | DKIM signature |
   | MX   | `send` | `feedback-smtp.<region>.amazonses.com` (priority 10) | bounce handling |
   | TXT  | `send` | `v=spf1 include:amazonses.com ~all` | SPF |
   | TXT  | `_dmarc` *(optional, recommended)* | `v=DMARC1; p=none; rua=mailto:you@hudlgo.com` | DMARC reporting |

   On Cloudflare set every one of these to **DNS only** (grey cloud), never proxied.
   They use the `send.` / `resend._domainkey.` sub-names, so they don't clash
   with any existing MX/SPF records on the apex.
4. **Wait for verification**: back in Resend click *Verify DNS records*. It usually
   turns green within minutes (up to a few hours while DNS propagates).
5. **Create an API key**: *API Keys → Create API key* → permission *Sending access*,
   domain `hudlgo.com`. Copy the `re_…` value (shown once).
6. **Set it on the VPS** in `.env.prod`:
   ```bash
   RESEND_API_KEY=re_your_key_here
   MAIL_FROM="hudlgo <noreply@hudlgo.com>"
   APP_URL=https://hudlgo.com          # base URL used inside email links
   ```
7. Recreate the api container so it picks up the env (same two-file command as
   `deploy.sh`):
   ```bash
   docker compose -f docker-compose.prod.yml -f docker-compose.traefik.yml --env-file .env.prod up -d api
   ```
8. **Test**: open `https://hudlgo.com/forgot-password`, enter your own address, and
   check the email arrives (and isn't in spam). `docker compose … logs api | grep -i resend`
   shows any delivery error.

> Existing accounts were marked verified by the migration that introduced email
> verification, so only accounts created after this release get the
> verification email and the "verify your email" banner.

## 9. Day-2 operations

**Update / redeploy after code changes**
```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```
Migrations are applied automatically on boot. The prod seed is idempotent and
never deletes data, so redeploys are safe.

**Backups (database + uploads), daily, free**

`scripts/backup.sh` dumps MySQL (consistent `mysqldump --single-transaction`,
gzipped) and tars the `uploads` volume, both streamed out of the running
containers. It writes them to `~/hudlgo-backups/YYYY-MM-DD/`, keeps the last
**14 days**, verifies each archive and logs to `~/hudlgo-backups/backup.log`. It
never stops anything.

```bash
cd ~/meetupwebapp && bash scripts/backup.sh     # run once by hand to check it works
```

Schedule it every day at 03:30 (`crontab -e` as the deploy user):
```cron
30 3 * * * cd $HOME/meetupwebapp && bash scripts/backup.sh >/dev/null 2>&1
```

**Off-site copy to Google Drive (free 15 GB) with rclone.** Without this, a dead
VPS takes the backups with it.
1. Install rclone on the VPS: `curl https://rclone.org/install.sh | sudo bash`
2. The VPS has no browser, so authorise on your laptop: install rclone there
   too and run `rclone authorize "drive"`. Sign in with the Google account that
   should hold the backups, then copy the token JSON it prints.
3. On the VPS run `rclone config` → `n` (new remote) → name **`gdrive`** →
   storage **`drive`** → leave client id/secret empty → scope **`drive.file`**
   (rclone only sees the files it creates) → *Edit advanced config?* `n` →
   *Use web browser to automatically authenticate?* **`n`** → paste the token
   from step 2 → *Shared drive?* `n` → confirm.
4. Test it: `rclone mkdir gdrive:hudlgo-backups && rclone lsd gdrive:`
5. Add `RCLONE_REMOTE=gdrive:hudlgo-backups` to `.env.prod`. The next backup
   copies the day's folder to Drive and prunes Drive copies older than 14 days.

A day of backups is roughly the size of the gzipped DB plus your photos, which are
small WebP files. 14 days fits comfortably in 15 GB for a long time.

**Restore** (⚠️ overwrites live data; asks you to type `RESTORE`):
```bash
bash scripts/restore.sh 2026-11-24                 # database + uploads from that day
bash scripts/restore.sh 2026-11-24 --db-only       # or --uploads-only
# from Google Drive first:
rclone copy gdrive:hudlgo-backups/2026-11-24 ~/hudlgo-backups/2026-11-24
```
The api is stopped during a database restore and started again afterwards. Any
newer migrations are re-applied on boot.

**Free uptime monitoring (optional): UptimeRobot**

1. Create a free account at <https://uptimerobot.com> (50 monitors, 5-minute
   checks, email alerts).
2. *Add New Monitor* → type **HTTP(s)** → URL `https://api.hudlgo.com/health` →
   friendly name `hudlgo API` → interval 5 min → alert contact = your email
   (the free plan also offers the mobile app's push notifications).
3. Add a second **HTTP(s)** monitor for `https://hudlgo.com` (`hudlgo web`). If you
   want, use the *Keyword* type with keyword `hudlgo` to catch a blank page.
4. Optional: *Status pages* → create a free public status page with both monitors.

`/health` is public, cheap and doesn't touch user data, so pinging it every 5
minutes costs nothing.

**Logs / status / stop**
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f api
docker compose -f docker-compose.prod.yml --env-file .env.prod down   # stop (keeps volumes/data)
```

Persistent data lives in named volumes: `mysql_data` (DB), `uploads` (user photos),
`caddy_data` (TLS certs). `down` keeps them; `down -v` **deletes** them — don't.

**Uploads** stay on the VPS disk (the `uploads` volume). The api only accepts
JPG/PNG/WebP photos (checked by file signature, ≤5 MB). It re-encodes them to WebP
(≤1600 px, quality 80) with EXIF/GPS stripped, and deletes the old file when an
avatar or venue photo is replaced. Business documents may also be PDFs (≤8 MB).
Storage sits behind a `StorageDriver` interface
(`server/src/storage/storage.driver.ts`), so moving to S3-compatible storage later
means adding a driver, not touching callers.

## 10. Paid plans: offline payment + manual activation

hudlgo has **no payment gateway**. Customers pay by bank transfer, CashPlus or
cash, and an admin switches the plan on.

**Set the payment instructions** (shown to the customer with every request) in
`.env.prod`, one per language. `{amount}` (MAD) and `{reference}` (e.g. `HG-4F7K2`)
are filled in automatically; write `\n` for a line break:
```bash
PAYMENT_INSTRUCTIONS_EN="Send {amount} MAD by bank transfer to RIB 000 000 0000000000000000 00 (hudlgo) or by CashPlus, and write {reference} in the description. Then message us on WhatsApp +212 6XX XX XX XX."
PAYMENT_INSTRUCTIONS_FR="Envoie {amount} MAD par virement au RIB … avec la référence {reference}. Puis écris-nous sur WhatsApp au +212 6XX XX XX XX."
PAYMENT_INSTRUCTIONS_AR="صيفط {amount} درهم … وكتب {reference} ف الوصف."
```
Then recreate the api container (`… up -d api`).

**Day to day:**
1. A customer taps *Request upgrade* (Pricing / business *Plan* page / *Pinned* in
   the create flow) and gets the amount + reference. Admins get an in-app
   notification.
2. When the money arrives, open **/admin → Upgrade requests**, find the reference,
   pick the length (defaults to the requested 1 / 3 / 12 months) and **Approve**.
   The plan, sponsorship or pin is applied immediately and the customer is notified.
   **Reject** (with a note) if no payment came. A rejected or cancelled extra
   activity is cancelled with it.
3. **/admin → Plans** lets you grant, extend or revoke a person's Pro Host or a
   business's sponsorship directly, e.g. for a cash payment or a goodwill extension.
4. Every change is audit-logged (`SubscriptionEvent`, with the admin's id).
   Plans **don't auto-renew**: they drop back to Free at their end date, and
   customers get an email + in-app reminder about 5 days before.

## 11. One-command & automatic deploys

> The live **hudlgo.com** box runs behind a shared, host-mode Traefik (alongside
> n8n), so it deploys with **both** compose files, not just `docker-compose.prod.yml`.
> `deploy.sh` already uses the correct two-file command.

**One command (on the VPS):**
```bash
cd ~/meetupwebapp && bash deploy.sh
```
`deploy.sh` fast-forwards `main`, rebuilds + restarts the stack
(`docker-compose.prod.yml` + `docker-compose.traefik.yml` + `.env.prod`), and
prunes dangling images. `.env.prod` is gitignored, so secrets are never touched.

**Zero-touch (on every push to `main`):** `.github/workflows/deploy.yml` SSHes in
and runs `deploy.sh`. Add three repository secrets
(**Settings → Secrets and variables → Actions**):

| Secret | Value |
|--------|-------|
| `VPS_HOST` | server IP/hostname (e.g. `2.24.210.201`) |
| `VPS_USER` | SSH user (e.g. `root`) |
| `VPS_SSH_KEY` | a **dedicated** deploy **private** key (full text, incl. BEGIN/END) |

Create the deploy key and authorize it on the VPS (run locally):
```bash
ssh-keygen -t ed25519 -C hudlgo-deploy -f deploy_key -N ''
# put the PUBLIC half on the server:
ssh-copy-id -i deploy_key.pub <VPS_USER>@<VPS_HOST>
#   …or append the contents of deploy_key.pub to the VPS's ~/.ssh/authorized_keys
# paste the PRIVATE half (the file `deploy_key`) into the VPS_SSH_KEY secret,
# then delete both local files.
```
The workflow runs only on pushes to `main` and manual **Actions → Run workflow**
(`workflow_dispatch`) — never on fork PRs — so the secrets stay safe. Use a
dedicated key (not your personal one) so you can revoke it independently.

---

### Notes & optional hardening

- **WebSockets** (real-time chat + live notification badges) run on the API at
  `wss://api.DOMAIN/socket.io/`. Traefik and Caddy both forward WebSocket upgrades
  out of the box, so nothing needs configuring. Socket CORS uses the same
  `FRONTEND_URL` allow-list as the REST API. If you put Cloudflare in front, keep
  *Network → WebSockets* enabled (it's on by default, free plan included).

- **Single-origin CORS**: the API only allows `https://DOMAIN`. `www` redirects to
  the apex before the app loads, so this is fine.
- **Swagger** (`/docs`) is publicly reachable. Harmless, but you can gate or
  disable it in `server/src/main.ts` for production if you prefer.
- **Firewall**: `ufw allow 22,80,443/tcp` and deny the rest. MySQL and the API are
  not published to the host — only Caddy is exposed.
- **Bundle size**: the SPA ships as one ~840 KB JS chunk (gzip ~240 KB). Fine for
  launch; code-split later if you want faster first paint.
