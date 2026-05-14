#!/usr/bin/env bash
# ============================================================================
# FemiGlow deploy script — idempotent, sécurisé, rollback automatique.
#
# Usage :
#   sudo ./bin/deploy.sh                  # deploy depuis origin/master
#   sudo ./bin/deploy.sh --no-build       # skip build (config-only changes)
#   sudo ./bin/deploy.sh --dry-run        # plan + validate, sans appliquer
#   sudo ./bin/deploy.sh --skip-backup    # skip backup (CI/dev only)
#
# Steps :
#   1. Preflight       : git clean, stash if dirty, fetch origin
#   2. Pull            : fast-forward to origin/master (refuse non-FF)
#   3. Deps            : pnpm install --frozen-lockfile
#   4. Validator       : node scripts/_validate-migrations.mjs (strict)
#   5. Backup DB       : pg_dump → /var/backups/femiglow/ + rotation 7j
#   6. Migrate         : node scripts/_migrate-safe.mjs
#   7. Build           : NODE_OPTIONS=--max-old-space-size=8192 pnpm build
#   8. Restart         : systemctl restart femiglow.service
#   9. Smoke tests     : curl 5 routes critiques
#  10. Rollback        : si smoke fail → restore git + restart
# ============================================================================
set -euo pipefail

ROOT="/var/www/femiglow"
WEB="$ROOT/apps/web"
BACKUP_DIR="/var/backups/femiglow"
SERVICE="femiglow.service"
PORT="8011"
LOG_TAG="deploy[$(date +%H%M%S)]"

NO_BUILD=0
DRY_RUN=0
SKIP_BACKUP=0
for arg in "$@"; do
  case "$arg" in
    --no-build)    NO_BUILD=1 ;;
    --dry-run)     DRY_RUN=1 ;;
    --skip-backup) SKIP_BACKUP=1 ;;
    *) echo "Unknown flag: $arg"; exit 64 ;;
  esac
done

log() { echo "[$LOG_TAG $(date +%H:%M:%S)] $*"; }
die() { log "ERROR: $*"; exit 1; }

cd "$ROOT"

# ── 1. Preflight ──────────────────────────────────────────────────────────
log "─── 1/10 Preflight ───"
[[ -d ".git" ]] || die "Not a git repo : $ROOT"

DIRTY=$(git status --porcelain | wc -l)
if (( DIRTY > 0 )); then
  log "Working tree has $DIRTY modified files. Stashing…"
  git stash push -u -m "deploy-auto-stash-$(date +%Y%m%d-%H%M%S)"
fi

git fetch origin master 2>&1 | tail -3

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/master)
if [[ "$LOCAL" == "$REMOTE" ]]; then
  log "Already at $REMOTE. No-op (unless --no-build for forced restart)."
  if (( NO_BUILD == 0 )); then
    log "Nothing to deploy. Exit."
    exit 0
  fi
fi

# Refuse if local is ahead (not a fast-forward).
if ! git merge-base --is-ancestor HEAD origin/master; then
  die "Local HEAD is ahead of origin/master — refusing non-FF deploy. Inspect manually."
fi

# ── 2. Pull ───────────────────────────────────────────────────────────────
log "─── 2/10 Pull ───"
PREV_HEAD="$LOCAL"
git merge --ff-only origin/master 2>&1 | tail -3
log "moved $PREV_HEAD → $(git rev-parse HEAD)"

# ── 3. Deps ───────────────────────────────────────────────────────────────
log "─── 3/10 Deps ───"
if (( DRY_RUN == 0 )); then
  pnpm install --frozen-lockfile 2>&1 | tail -3
else
  log "(dry-run) skip pnpm install"
fi

# ── 4. Validator ──────────────────────────────────────────────────────────
log "─── 4/10 Migration validator ───"
cd "$WEB"
node scripts/_validate-migrations.mjs --strict || die "Migration validator failed. Fix journal/SQL before retry."

# ── 5. Backup DB ──────────────────────────────────────────────────────────
log "─── 5/10 Backup DB ───"
if (( SKIP_BACKUP == 0 && DRY_RUN == 0 )); then
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/pre-deploy-$(date +%Y%m%d-%H%M%S).sql.gz"
  PG_PASS=$(grep -E '^DATABASE_URL' "$WEB/.env" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
  PGPASSWORD="$PG_PASS" pg_dump -h 127.0.0.1 -U femiglow femiglow | gzip > "$BACKUP_FILE"
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  log "Backup → $BACKUP_FILE ($BACKUP_SIZE)"
  # Rotation : keep 7 most recent backups.
  ls -tp "$BACKUP_DIR"/pre-deploy-*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
else
  log "(skip backup)"
fi

# ── 6. Migrate ────────────────────────────────────────────────────────────
log "─── 6/10 Migrate ───"
cd "$WEB"
if (( DRY_RUN == 1 )); then
  node --env-file=.env scripts/_migrate-safe.mjs --plan
else
  node --env-file=.env scripts/_migrate-safe.mjs 2>&1 | tail -15
fi

# ── 7. Build ──────────────────────────────────────────────────────────────
cd "$ROOT"
if (( NO_BUILD == 0 && DRY_RUN == 0 )); then
  log "─── 7/10 Build ───"
  NODE_OPTIONS="--max-old-space-size=8192" pnpm build 2>&1 | tail -10
else
  log "─── 7/10 Build skipped ───"
fi

if (( DRY_RUN == 1 )); then
  log "Dry-run complete. Exit before restart."
  exit 0
fi

# ── 8. Restart ────────────────────────────────────────────────────────────
log "─── 8/10 Restart $SERVICE ───"
systemctl restart "$SERVICE"
sleep 5
if ! systemctl is-active --quiet "$SERVICE"; then
  log "Service is NOT active after restart. Initiating rollback."
  do_rollback=1
fi

# ── 9. Smoke tests ────────────────────────────────────────────────────────
log "─── 9/10 Smoke tests ───"
SMOKE_PATHS=(
  "/"
  "/admin/emails"
  "/admin/legal"
  "/api/health"
)
FAILED=0
for path in "${SMOKE_PATHS[@]}"; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:$PORT$path" || echo "000")
  # Accept 200 (public), 307 (redirect login = OK for admin), and 200 for /api/health.
  if [[ "$CODE" =~ ^(200|307|308)$ ]]; then
    log "  ✓ $path → $CODE"
  else
    log "  ✗ $path → $CODE  (FAIL)"
    FAILED=$((FAILED + 1))
  fi
done

if (( FAILED > 0 )); then
  log "Smoke FAILED ($FAILED routes). Rolling back."
  do_rollback=1
fi

# ── 10. Rollback if needed ────────────────────────────────────────────────
if [[ "${do_rollback:-0}" == "1" ]]; then
  log "─── 10/10 ROLLBACK ───"
  git reset --hard "$PREV_HEAD"
  cd "$ROOT" && pnpm install --frozen-lockfile 2>&1 | tail -3
  NODE_OPTIONS="--max-old-space-size=8192" pnpm build 2>&1 | tail -3
  systemctl restart "$SERVICE"
  log "Rolled back to $PREV_HEAD."
  exit 1
fi

log "─── 10/10 DONE ✅ ───"
log "Deployed $(git rev-parse --short HEAD)"
