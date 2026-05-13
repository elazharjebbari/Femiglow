#!/bin/bash
# ============================================================================
# migrate-prod-tracking.sh — Migration prod tracking-improvement (0028→0030)
# ----------------------------------------------------------------------------
# Orchestre l'application des migrations 0028, 0029, 0030 sur une DB
# qui peut avoir un journal `drizzle.__drizzle_migrations` vide ou peuplé.
#
# Phases :
#   1. Sanity checks (env vars, binaires, fichiers, DATABASE_URL non localhost)
#   2. Backup pg_dump (skippable via --skip-backup)
#   3. Audit du journal (compte d'entrées vs schema réel)
#   4. Baseline 0000-0027 si journal vide (migrate-baseline.ts)
#   5. Apply 0028→0030 via drizzle-kit migrate (méthode officielle)
#   6. Verify (5 checks colonnes/tables + journal final)
#   7. Resume écrit dans le log
#
# Flags :
#   --yes              Skip prompts interactifs
#   --dry-run          Tout simuler sans modifier la DB
#   --skip-backup      Pas de pg_dump (à RISQUES, dev uniquement)
#   --skip-baseline    Forcer le skip de l'étape baseline
#   --allow-local      Autoriser DATABASE_URL=localhost (dev/staging)
#
# Usage typique en prod :
#   sudo -u femiglow bash scripts/migrate-prod-tracking.sh --yes 2>&1 | \
#     tee /var/log/femiglow-migration-$(date +%F-%H%M).log
#
# Cf. docs/tracking-improvement/80-runbook/deployment.md.
# ============================================================================

set -euo pipefail

# --- Flags ------------------------------------------------------------------
YES=0
DRY_RUN=0
SKIP_BACKUP=0
SKIP_BASELINE=0
ALLOW_LOCAL=0
for arg in "$@"; do
  case "$arg" in
    --yes)           YES=1 ;;
    --dry-run)       DRY_RUN=1 ;;
    --skip-backup)   SKIP_BACKUP=1 ;;
    --skip-baseline) SKIP_BASELINE=1 ;;
    --allow-local)   ALLOW_LOCAL=1 ;;
    -h|--help)
      sed -n '2,/^# =====/p' "$0" | sed 's/^# //; s/^#//'
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg" >&2
      exit 2
      ;;
  esac
done

# --- Helpers ----------------------------------------------------------------
log() { echo "[$(date -u +%FT%TZ)] $*"; }
die() { log "FATAL: $*"; exit 1; }

confirm() {
  if [ "$YES" -eq 1 ]; then return 0; fi
  read -r -p "$1 [y/N] " ans
  case "$ans" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

# --- Phase 1 : sanity checks ------------------------------------------------
log "=== Phase 1 : sanity checks ==="

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
WEB_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
DRIZZLE_BIN="$WEB_DIR/node_modules/.bin/drizzle-kit"
TSX_BIN="$WEB_DIR/node_modules/.bin/tsx"
ENV_FILE="$WEB_DIR/.env"
MIGRATIONS_DIR="$WEB_DIR/drizzle/migrations"

[ -f "$ENV_FILE" ]      || die ".env introuvable : $ENV_FILE"
[ -x "$DRIZZLE_BIN" ]   || die "drizzle-kit non installé : $DRIZZLE_BIN"
[ -x "$TSX_BIN" ]       || die "tsx non installé : $TSX_BIN"
command -v psql >/dev/null || die "psql introuvable dans PATH"
command -v pg_dump >/dev/null || die "pg_dump introuvable dans PATH"

# Charge DATABASE_URL depuis .env (resolve symlinks)
DATABASE_URL=$(grep ^DATABASE_URL "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')
[ -n "$DATABASE_URL" ] || die "DATABASE_URL absent du .env"
export DATABASE_URL

if echo "$DATABASE_URL" | grep -q localhost && [ "$ALLOW_LOCAL" -eq 0 ]; then
  die "DATABASE_URL pointe sur localhost. Use --allow-local pour autoriser (dev/staging)."
fi

log "DATABASE_URL host: $(echo "$DATABASE_URL" | sed -E 's|^.*@([^/:]+).*$|\1|')"
log "DATABASE_URL db  : $(echo "$DATABASE_URL" | sed -E 's|^.*/([^?]+).*$|\1|')"
log "Migrations dir   : $MIGRATIONS_DIR"
log "Dry-run          : $DRY_RUN"

# Migrations cibles attendues à appliquer en plus
TARGET_MIGRATIONS=(
  "0028_tracking_event_id_gclid"
  "0029_tracking_event_category_default"
  "0030_tracking_event_overrides"
)
for m in "${TARGET_MIGRATIONS[@]}"; do
  [ -f "$MIGRATIONS_DIR/$m.sql" ] || die "SQL manquant : $m.sql"
done

# Test connexion
psql "$DATABASE_URL" -tAc "SELECT 1" >/dev/null || die "Connexion DB échouée"
log "Connexion DB OK"

confirm "Prêt à démarrer la migration tracking-improvement ?" \
  || { log "Annulé par l'utilisateur."; exit 0; }

# --- Phase 2 : backup -------------------------------------------------------
if [ "$SKIP_BACKUP" -eq 1 ]; then
  log "=== Phase 2 : backup SKIPPÉ (--skip-backup) ==="
else
  log "=== Phase 2 : backup pg_dump ==="
  BACKUP_DIR="${BACKUP_DIR:-/var/backups/femiglow}"
  mkdir -p "$BACKUP_DIR" || die "Impossible de créer $BACKUP_DIR (lance via sudo ou définis BACKUP_DIR=)"
  BACKUP_FILE="$BACKUP_DIR/pre-tracking-improvement-$(date +%Y%m%d-%H%M%S).dump"
  if [ "$DRY_RUN" -eq 1 ]; then
    log "DRY-RUN : pg_dump → $BACKUP_FILE"
  else
    pg_dump "$DATABASE_URL" -Fc -f "$BACKUP_FILE" \
      || die "pg_dump échoué — STOP avant migration"
    log "Backup : $BACKUP_FILE ($(stat -f %z "$BACKUP_FILE" 2>/dev/null || stat -c %s "$BACKUP_FILE") octets)"
  fi
fi

# --- Phase 3 : audit du journal --------------------------------------------
log "=== Phase 3 : audit du journal __drizzle_migrations ==="

# Compte entrées dans le journal (table peut ne pas exister)
JOURNAL_COUNT=$(psql "$DATABASE_URL" -tAc \
  "SELECT count(*) FROM drizzle.__drizzle_migrations" 2>/dev/null || echo "0")
JOURNAL_COUNT=${JOURNAL_COUNT:-0}
log "Entrées dans drizzle.__drizzle_migrations : $JOURNAL_COUNT"

# Check rapide : la DB est-elle "vierge" (0 table app) ou peuplée ?
APP_TABLES=$(psql "$DATABASE_URL" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('admin_users', 'tracking_event_definitions', 'chat_lead')")
log "Tables applicatives présentes (échantillon) : $APP_TABLES / 3"

if [ "$APP_TABLES" = "0" ]; then
  die "DB vierge (0 table applicative). Lance d'abord pnpm db:migrate sur une DB neuve, pas ce script."
fi

# Décision baseline
NEED_BASELINE=0
if [ "$JOURNAL_COUNT" = "0" ] && [ "$SKIP_BASELINE" -eq 0 ]; then
  NEED_BASELINE=1
  log "Journal vide + DB peuplée → baseline 0000-0027 requise."
elif [ "$JOURNAL_COUNT" -lt 28 ] && [ "$SKIP_BASELINE" -eq 0 ]; then
  log "Journal partiel ($JOURNAL_COUNT < 28). On baselinera les hashes manquants ≤ 0027."
  NEED_BASELINE=1
else
  log "Journal a $JOURNAL_COUNT entrée(s) ≥ 28 → pas de baseline nécessaire."
fi

# --- Phase 4 : baseline 0000-0027 ------------------------------------------
if [ "$NEED_BASELINE" -eq 1 ]; then
  log "=== Phase 4 : baseline 0000-0027 ==="
  cd "$WEB_DIR"
  BASELINE_ARGS=""
  if [ "$DRY_RUN" -eq 1 ]; then BASELINE_ARGS="$BASELINE_ARGS --dry-run"; fi
  # Propage --allow-local au sous-process TS via env var.
  if [ "$ALLOW_LOCAL" -eq 1 ]; then export ALLOW_LOCAL_BASELINE=1; fi
  "$TSX_BIN" scripts/migrate-baseline.ts $BASELINE_ARGS || die "baseline échoué"
else
  log "=== Phase 4 : baseline skip ==="
fi

# --- Phase 5 : drizzle-kit migrate -----------------------------------------
log "=== Phase 5 : drizzle-kit migrate ==="
cd "$WEB_DIR"
if [ "$DRY_RUN" -eq 1 ]; then
  log "DRY-RUN : drizzle-kit migrate skip. Les fichiers 0028-0030 SERAIENT appliqués ici."
else
  # drizzle-kit migrate lit le journal local + l'état DB et applique le delta.
  # Avec la baseline 0000-0027 en place, seules 0028-0030 seront appliquées.
  "$DRIZZLE_BIN" migrate 2>&1 | tee -a /tmp/drizzle-migrate.log
fi

# --- Phase 6 : verify ------------------------------------------------------
log "=== Phase 6 : verify ==="

VERIFY_SQL=$(cat <<'SQL'
SELECT 'gclid' AS check_name,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_name='tracking_events_log' AND column_name='gclid') AS present
UNION ALL SELECT 'google_ads_category_default',
  (SELECT count(*) FROM information_schema.columns
   WHERE table_name='tracking_event_definitions' AND column_name='google_ads_category_default')
UNION ALL SELECT 'tracking_event_overrides_table',
  (SELECT count(*) FROM information_schema.tables WHERE table_name='tracking_event_overrides')
UNION ALL SELECT 'google_ads_category_type',
  (SELECT count(*) FROM pg_type WHERE typname='google_ads_category')
UNION ALL SELECT 'event_defs_seeded_purchase',
  (SELECT count(*) FROM tracking_event_definitions
   WHERE name='purchase' AND google_ads_category_default='purchase');
SQL
)

if [ "$DRY_RUN" -eq 1 ]; then
  log "DRY-RUN : skip verify."
else
  log "Résultats verify :"
  psql "$DATABASE_URL" -c "$VERIFY_SQL" || die "verify SQL échoué"
  log "Journal final :"
  psql "$DATABASE_URL" -c \
    "SELECT count(*) AS total_entries, max(created_at) AS last_when FROM drizzle.__drizzle_migrations"
fi

# --- Phase 7 : récap -------------------------------------------------------
log "=== Migration tracking-improvement TERMINÉE ==="
log "Migrations appliquées : ${TARGET_MIGRATIONS[*]}"
if [ "$SKIP_BACKUP" -eq 0 ] && [ "$DRY_RUN" -eq 0 ]; then
  log "Backup disponible    : $BACKUP_FILE"
  log "Rollback DB           : bash scripts/migrate-prod-tracking-rollback.sh"
fi
log "Smoke tests           : bash scripts/smoke-tracking.sh \$(BASE_URL)"
