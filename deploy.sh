#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# One-command production redeploy for hudlgo.com (Hostinger VPS).
#
# Pulls the latest `main` and rebuilds the Docker stack that runs behind the
# shared, host-mode Traefik (alongside n8n) — i.e. BOTH compose files, not the
# standalone Caddy edge. Run it from the repo root on the VPS:
#
#     cd ~/meetupwebapp && bash deploy.sh
#
# It is also what the GitHub Actions deploy workflow invokes over SSH.
# Secrets live in .env.prod on the box (gitignored) and are never touched here.
# ---------------------------------------------------------------------------
set -euo pipefail

# Always operate from the repo root (the directory this script lives in).
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.traefik.yml --env-file .env.prod"

echo "==> Pulling latest main…"
git fetch origin main
# Fast-forward only: if the VPS working tree has diverged, fail loudly rather
# than silently discarding local state. (.env.prod / *.zip are gitignored.)
git merge --ff-only origin/main

echo "==> Rebuilding and restarting containers…"
$COMPOSE up -d --build

echo "==> Removing dangling images to reclaim disk…"
docker image prune -f

echo "==> Status:"
$COMPOSE ps

echo "==> Done. Tail logs with:"
echo "    $COMPOSE logs -f api"
