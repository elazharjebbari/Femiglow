#!/usr/bin/env bash
# preflight-db-state.sh — T01/T02 : relevé LECTURE SEULE de l'état emailing en DB prod.
# GATE T02 : exit 3 si des runs d'automation sont "dus" (se réveilleraient à P2).
# N'affiche JAMAIS la DATABASE_URL.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/var/www/femiglow/apps/web/.env}"
DBURL="$(grep '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
[[ -n "$DBURL" ]] || { echo "DATABASE_URL introuvable dans $ENV_FILE" >&2; exit 2; }

q() { psql "$DBURL" -X -At -v ON_ERROR_STOP=1 -c "$1"; }

echo "== T01 — email_outbox par statut =="
psql "$DBURL" -X -v ON_ERROR_STOP=1 -c \
  "SELECT status, count(*) FROM email_outbox GROUP BY status ORDER BY count(*) DESC;"

echo "== T01 — suppressions / events =="
echo "suppressions: $(q 'SELECT count(*) FROM email_suppression;')"
echo "email_event (30 derniers jours): $(q "SELECT count(*) FROM email_event WHERE ts > now() - interval '30 days';")"

echo "== T02 — automations =="
psql "$DBURL" -X -v ON_ERROR_STOP=1 -c \
  "SELECT active, count(*) FROM email_automation GROUP BY active ORDER BY 1;"
psql "$DBURL" -X -v ON_ERROR_STOP=1 -c \
  "SELECT status, count(*) FROM email_automation_run GROUP BY status ORDER BY 1;"

DUS="$(q "SELECT count(*) FROM email_automation_run
          WHERE status IN ('running','waiting_for_event') AND next_action_at <= now();")"
echo "runs DUS (se réveilleraient à l'activation du timer automation) : $DUS"

if [[ "$DUS" != "0" ]]; then
  echo "GATE T02 : $DUS run(s) dormant(s) éligibles — STOP, arbitrage requis avant P2." >&2
  psql "$DBURL" -X -v ON_ERROR_STOP=1 -c \
    "SELECT id, automation_id, status, next_action_at, triggered_at
     FROM email_automation_run
     WHERE status IN ('running','waiting_for_event') AND next_action_at <= now()
     ORDER BY next_action_at LIMIT 20;"
  exit 3
fi
echo "GATE T02 : OK (0 run dû)."
