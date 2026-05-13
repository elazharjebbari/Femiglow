#!/bin/bash
# ============================================================================
# migrate-prod-tracking-rollback.sh — Rollback des migrations 0028→0030
# ----------------------------------------------------------------------------
# Les 3 migrations sont strictement additives. Rollback = drop des colonnes/
# tables/types ajoutés. Perte de données limitée à :
#   - tracking_events_log.gclid (click IDs capturés depuis le deploy)
#   - tracking_event_definitions.google_ads_category_default (recalculable)
#   - tracking_event_overrides (overrides admin manuels saisis depuis le deploy)
#
# Pour une perte zéro, restaurer le backup pg_dump pré-deploy à la place.
#
# Flags :
#   --yes               Skip prompt
#   --dry-run           Affiche le SQL sans l'exécuter
#   --keep-journal      Ne pas DELETE les rows de __drizzle_migrations
#                       (utile si on veut re-tenter sans baseline ré-écrire)
#   --allow-local       Autoriser DATABASE_URL=localhost
#
# Cf. docs/tracking-improvement/80-runbook/rollback.md procédure B.
# ============================================================================

set -euo pipefail

YES=0; DRY_RUN=0; KEEP_JOURNAL=0; ALLOW_LOCAL=0
for arg in "$@"; do
  case "$arg" in
    --yes)          YES=1 ;;
    --dry-run)      DRY_RUN=1 ;;
    --keep-journal) KEEP_JOURNAL=1 ;;
    --allow-local)  ALLOW_LOCAL=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

log() { echo "[$(date -u +%FT%TZ)] $*"; }
die() { log "FATAL: $*"; exit 1; }

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
WEB_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
ENV_FILE="$WEB_DIR/.env"
[ -f "$ENV_FILE" ] || die ".env introuvable"
DATABASE_URL=$(grep ^DATABASE_URL "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')
export DATABASE_URL

if echo "$DATABASE_URL" | grep -q localhost && [ "$ALLOW_LOCAL" -eq 0 ]; then
  die "DATABASE_URL=localhost — utilise --allow-local pour confirmer (dev)."
fi

log "Rollback tracking-improvement sur DB $(echo "$DATABASE_URL" | sed -E 's|^.*/([^?]+).*$|\1|')"

if [ "$YES" -ne 1 ]; then
  read -r -p "Confirmer rollback (DROP colonnes/table additives) ? [y/N] " ans
  case "$ans" in y|Y|yes|YES) ;; *) log "Annulé."; exit 0 ;; esac
fi

# Phase DROP applicative
DROP_SQL=$(cat <<'SQL'
BEGIN;
-- 0030 — drop la table override.
DROP TABLE IF EXISTS tracking_event_overrides;
-- 0029 — drop la colonne default + l'enum.
ALTER TABLE tracking_event_definitions DROP COLUMN IF EXISTS google_ads_category_default;
DROP TYPE IF EXISTS google_ads_category;
-- 0028 — drop l'index puis la colonne gclid.
DROP INDEX IF EXISTS tracking_events_log_gclid_idx;
ALTER TABLE tracking_events_log DROP COLUMN IF EXISTS gclid;
COMMIT;
SQL
)

if [ "$DRY_RUN" -eq 1 ]; then
  echo "--- DRY-RUN SQL ---"; echo "$DROP_SQL"; echo "--- END DRY-RUN ---"
  exit 0
fi

echo "$DROP_SQL" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1
log "Phase DROP terminée."

# Phase journal cleanup — séparée car les hashes sont calculés en TS pour matcher
# exactement ce que la baseline avait inséré.
if [ "$KEEP_JOURNAL" -ne 1 ]; then
  log "Cleanup journal : retire les hashes 0028-0030 via tsx."
  TSX_BIN="$WEB_DIR/node_modules/.bin/tsx"
  if [ -x "$TSX_BIN" ]; then
    cd "$WEB_DIR" && "$TSX_BIN" -e "
      const { readFileSync } = await import('node:fs');
      const { createHash } = await import('node:crypto');
      const { join } = await import('node:path');
      const postgres = (await import('postgres')).default;
      const sql = postgres(process.env.DATABASE_URL, { max: 1 });
      const dir = 'drizzle/migrations';
      const targets = [
        '0028_tracking_event_id_gclid',
        '0029_tracking_event_category_default',
        '0030_tracking_event_overrides',
      ];
      const hashes = targets.map((t) => createHash('sha256').update(readFileSync(join(dir, t + '.sql'), 'utf8')).digest('hex'));
      const rows = await sql\`DELETE FROM drizzle.__drizzle_migrations WHERE hash = ANY(\${hashes}::text[]) RETURNING hash\`;
      console.log('Deleted ' + rows.length + ' journal row(s).');
      await sql.end();
    " || log "WARN : cleanup journal a échoué (non bloquant)"
  else
    log "WARN : tsx introuvable — skip cleanup journal."
  fi
fi

log "Verify post-rollback :"
psql "$DATABASE_URL" -c "
SELECT 'gclid_dropped' AS check_name,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_name='tracking_events_log' AND column_name='gclid') AS still_present
UNION ALL SELECT 'overrides_dropped',
  (SELECT count(*) FROM information_schema.tables WHERE table_name='tracking_event_overrides')
UNION ALL SELECT 'category_default_dropped',
  (SELECT count(*) FROM information_schema.columns
   WHERE table_name='tracking_event_definitions' AND column_name='google_ads_category_default');
"
log "Si still_present=0 partout, rollback DB OK."
log "Pense aussi à : git reset --hard pre-tracking-improvement-2026-05-13 + rebuild."
