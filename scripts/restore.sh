#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# hudlgo — restore a backup made by scripts/backup.sh.
#
#   bash scripts/restore.sh 2026-11-24            # DB + uploads from that day
#   bash scripts/restore.sh 2026-11-24 --db-only
#   bash scripts/restore.sh 2026-11-24 --uploads-only
#   bash scripts/restore.sh /path/to/folder        # any folder with db-*.sql.gz / uploads-*.tar.gz
#
# To restore from Google Drive first:  rclone copy "$RCLONE_REMOTE/2026-11-24" ~/hudlgo-backups/2026-11-24
#
# ⚠️ OVERWRITES the live database and uploads. It asks for confirmation (type
# RESTORE), or pass --yes. The api is stopped during the restore and started again.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

BACKUP_ROOT="${BACKUP_ROOT:-$HOME/hudlgo-backups}"
ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.traefik.yml --env-file $ENV_FILE"

WHICH="${1:-}"
[ -n "$WHICH" ] || { echo "Usage: $0 <YYYY-MM-DD | folder> [--db-only|--uploads-only] [--yes]"; exit 1; }
shift || true
DO_DB=1; DO_UP=1; YES=0
for arg in "$@"; do
  case "$arg" in
    --db-only) DO_UP=0 ;;
    --uploads-only) DO_DB=0 ;;
    --yes) YES=1 ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

SRC="$WHICH"
[ -d "$SRC" ] || SRC="$BACKUP_ROOT/$WHICH"
[ -d "$SRC" ] || { echo "No backup folder: $SRC"; exit 1; }
DB_FILE="$(ls -1 "$SRC"/db-*.sql.gz 2>/dev/null | tail -n1 || true)"
UP_FILE="$(ls -1 "$SRC"/uploads-*.tar.gz 2>/dev/null | tail -n1 || true)"
[ "$DO_DB" = 0 ] || [ -n "$DB_FILE" ] || { echo "No db-*.sql.gz in $SRC"; exit 1; }
[ "$DO_UP" = 0 ] || [ -n "$UP_FILE" ] || { echo "No uploads-*.tar.gz in $SRC"; exit 1; }

echo "Restoring from $SRC"
[ "$DO_DB" = 1 ] && echo "  database ← $(basename "$DB_FILE")"
[ "$DO_UP" = 1 ] && echo "  uploads  ← $(basename "$UP_FILE")"
if [ "$YES" != 1 ]; then
  read -r -p "This OVERWRITES live data. Type RESTORE to continue: " answer
  [ "$answer" = "RESTORE" ] || { echo "Aborted."; exit 1; }
fi

# Integrity checks before touching anything.
[ "$DO_DB" = 0 ] || gzip -t "$DB_FILE"
[ "$DO_UP" = 0 ] || tar -tzf "$UP_FILE" > /dev/null

if [ "$DO_DB" = 1 ]; then
  echo "==> Stopping api…"
  $COMPOSE stop api
  echo "==> Restoring database…"
  gzip -dc "$DB_FILE" | $COMPOSE exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
fi

if [ "$DO_UP" = 1 ]; then
  echo "==> Restoring uploads…"
  # A one-off container from the api image with the same volume mounted (works while api is stopped).
  $COMPOSE run --rm --no-deps -T --entrypoint sh api -c 'find /app/uploads -mindepth 1 -delete && tar -C /app/uploads -xzf -' < "$UP_FILE"
fi

echo "==> Starting api (applies any newer migrations on boot)…"
$COMPOSE up -d api
echo "==> Restore complete."
