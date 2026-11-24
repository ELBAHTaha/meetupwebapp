#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# hudlgo — daily backup (run on the VPS, from cron).
#
#   • MySQL: consistent mysqldump through the compose `mysql` service (gzip)
#   • Uploads: tarball of the api container's /app/uploads (the `uploads` volume)
#   • Saved under  $BACKUP_ROOT/YYYY-MM-DD/   (default ~/hudlgo-backups)
#   • Keeps the last $KEEP_DAYS days locally (default 14)
#   • Optional off-site copy with rclone when RCLONE_REMOTE is set
#     (e.g. RCLONE_REMOTE=gdrive:hudlgo-backups — see DEPLOY.md §9)
#   • Logs to $BACKUP_ROOT/backup.log
#
# Usage:  bash scripts/backup.sh
# Cron:   30 3 * * * cd ~/meetupwebapp && bash scripts/backup.sh >/dev/null 2>&1
#
# Reads only; never stops containers. Needs no extra packages on the host
# (mysqldump/tar run inside the containers).
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

BACKUP_ROOT="${BACKUP_ROOT:-$HOME/hudlgo-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.traefik.yml --env-file $ENV_FILE"

# Let RCLONE_REMOTE (and friends) come from .env.prod without exporting them by hand.
if [ -z "${RCLONE_REMOTE:-}" ] && [ -f "$ENV_FILE" ]; then
  RCLONE_REMOTE="$(grep -E '^RCLONE_REMOTE=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"' || true)"
fi

DAY="$(date +%F)"
DEST="$BACKUP_ROOT/$DAY"
LOG="$BACKUP_ROOT/backup.log"
mkdir -p "$DEST"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }
fail() { log "ERROR: $*"; exit 1; }
trap 'fail "backup aborted (line $LINENO)"' ERR

log "=== backup start → $DEST"

# 1) Database — --single-transaction gives a consistent InnoDB snapshot without locking.
DB_FILE="$DEST/db-$DAY.sql.gz"
$COMPOSE exec -T mysql sh -c \
  'exec mysqldump --single-transaction --quick --routines --triggers --no-tablespaces -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  2>>"$LOG" | gzip -9 > "$DB_FILE.tmp"
# A dump without the completion footer means mysqldump died part-way.
gzip -dc "$DB_FILE.tmp" | tail -n 1 | grep -q 'Dump completed' || fail "database dump looks incomplete"
mv "$DB_FILE.tmp" "$DB_FILE"
log "database → $(basename "$DB_FILE") ($(du -h "$DB_FILE" | cut -f1))"

# 2) Uploads — streamed out of the api container (works whatever the volume is called).
UP_FILE="$DEST/uploads-$DAY.tar.gz"
$COMPOSE exec -T api tar -C /app/uploads -czf - . 2>>"$LOG" > "$UP_FILE.tmp"
tar -tzf "$UP_FILE.tmp" > /dev/null || fail "uploads archive is corrupt"
mv "$UP_FILE.tmp" "$UP_FILE"
log "uploads  → $(basename "$UP_FILE") ($(du -h "$UP_FILE" | cut -f1), $(tar -tzf "$UP_FILE" | grep -vc '/$' || true) files)"

# 3) Local retention — drop dated folders older than KEEP_DAYS.
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '20??-??-??' -mtime "+$((KEEP_DAYS - 1))" -print0 |
  while IFS= read -r -d '' old; do rm -rf -- "$old"; log "pruned $(basename "$old")"; done

# 4) Optional off-site copy (free Google Drive via rclone).
if [ -n "${RCLONE_REMOTE:-}" ]; then
  if command -v rclone > /dev/null 2>&1; then
    rclone copy "$DEST" "$RCLONE_REMOTE/$DAY" --log-file "$LOG" --log-level NOTICE
    # Same retention off-site: delete files older than KEEP_DAYS, then empty folders.
    rclone delete "$RCLONE_REMOTE" --min-age "${KEEP_DAYS}d" --log-file "$LOG" --log-level NOTICE || true
    rclone rmdirs "$RCLONE_REMOTE" --leave-root --log-file "$LOG" --log-level NOTICE || true
    log "off-site → $RCLONE_REMOTE/$DAY"
  else
    log "WARN: RCLONE_REMOTE is set but rclone isn't installed — skipped off-site copy"
  fi
fi

trap - ERR
log "=== backup done"
