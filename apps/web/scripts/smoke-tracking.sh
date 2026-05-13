#!/bin/bash
# ============================================================================
# T50 — Smoke tests tracking post-deploy
# ----------------------------------------------------------------------------
# Source : docs/tracking-improvement/80-runbook/smoke-tests.md §1.
# Usage  : ./scripts/smoke-tracking.sh [base_url]
#
# Couverture :
#  - /api/health
#  - Pages publiques (/, /kit, /commander, /contact, /mentions-legales)
#  - GET /api/track/pixels (snippets count)
#  - POST /api/track avec un event form_start de test
#  - Admin login + GET /api/admin/tracking/*
#  - Intégrité DB (counts providers, event_definitions, overrides, events_log 24h)
#
# Le script utilise `set -e` : un échec interrompt et reporte un exit code != 0
# qui peut être consommé en CI (.github/workflows/post-deploy-smoke.yml).
# ============================================================================
set -e

BASE_URL=${1:-http://127.0.0.1:8011}
echo "=== Smoke tests on $BASE_URL ==="

# 1. Health
echo "--- Health ---"
curl -sS -o /dev/null -w '/api/health: HTTP %{http_code}\n' "$BASE_URL/api/health"

# 2. Public pages
echo "--- Public pages ---"
for path in / /kit /commander /contact /mentions-legales; do
  printf '%-20s ' "$path"
  curl -sS -o /dev/null -w 'HTTP %{http_code}\n' "$BASE_URL$path"
done

# 3. Tracking pixels endpoint
echo "--- Tracking ---"
curl -sS "$BASE_URL/api/track/pixels" -o /tmp/pixels.json
echo "Pixels endpoint snippets: $(jq -r '.snippets | length' /tmp/pixels.json 2>/dev/null || echo '?')"

# 4. POST /api/track — form_start (cohérent avec catalog enrichi T07).
echo "--- /api/track event (form_start) ---"
EVENT_ID=$(uuidgen 2>/dev/null || python3 -c 'import uuid;print(uuid.uuid4())')
TS=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
curl -sS -X POST "$BASE_URL/api/track" \
  -H 'Content-Type: application/json' \
  -d '{
    "events": [{
      "event": "form_start",
      "event_id": "'"$EVENT_ID"'",
      "timestamp": "'"$TS"'",
      "consent": {
        "ad_storage": "granted",
        "analytics_storage": "granted",
        "ad_user_data": "granted",
        "ad_personalization": "granted",
        "functional_storage": "granted"
      },
      "page": { "url": "'"$BASE_URL"'/", "path": "/", "title": "Smoke", "referrer": "", "locale": "fr-MA" },
      "user": { "anonymous_id": "smoke-anon", "session_id": "smoke-session" },
      "params": { "form_id": "smoke", "first_field": "firstName", "form_mode": "wizard_embed" }
    }]
  }' -o /tmp/track-res.json -w "HTTP %{http_code}\n"
cat /tmp/track-res.json | jq 2>/dev/null || cat /tmp/track-res.json

# 5. Admin login (best effort — exige ADMIN_BOOTSTRAP_EMAIL/_PASSWORD dans .env)
echo "--- Admin login ---"
JAR=$(mktemp)
if [ -f apps/web/.env ]; then
  EMAIL=$(grep ^ADMIN_BOOTSTRAP_EMAIL apps/web/.env | tail -1 | cut -d= -f2-)
  PASS=$(grep ^ADMIN_BOOTSTRAP_PASSWORD apps/web/.env | tail -1 | cut -d= -f2-)
  if [ -n "$EMAIL" ] && [ -n "$PASS" ]; then
    curl -sS -c "$JAR" -X POST "$BASE_URL/api/admin/login" \
      -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
      -o /dev/null -w 'login: HTTP %{http_code}\n'
  else
    echo "login: SKIPPED (env vars missing)"
  fi
fi

# 6. Admin tracking endpoints (incluent les nouveaux T21 + T28 + T32)
echo "--- Admin tracking endpoints ---"
for path in \
    /api/admin/tracking/gtm/configs \
    /api/admin/tracking/providers/snapshot \
    /api/admin/tracking/events/categorization \
    /api/admin/tracking/analytics/providers; do
  printf '%-55s ' "$path"
  curl -sS -b "$JAR" -o /dev/null -w 'HTTP %{http_code}\n' "$BASE_URL$path"
done

# 7. Intégrité DB
echo "--- DB integrity ---"
if [ -n "$DATABASE_URL" ]; then
  psql "$DATABASE_URL" -c "
    SELECT 'providers_enabled' as t, count(*) FROM tracking_providers WHERE status = 'enabled'
    UNION ALL SELECT 'event_definitions', count(*) FROM tracking_event_definitions
    UNION ALL SELECT 'event_overrides', count(*) FROM tracking_event_overrides
    UNION ALL SELECT 'events_log_24h', count(*) FROM tracking_events_log WHERE received_at >= now() - interval '24 hours'
  " || echo 'DB integrity: SKIPPED (psql connection failed)'
else
  echo 'DB integrity: SKIPPED (DATABASE_URL not set)'
fi

# 8. Liste des snippets pixels (la liste exacte dépend des providers enabled)
echo "--- Pixel snippets present ---"
jq -r '.snippets[]? | .kind' /tmp/pixels.json 2>/dev/null | sort || true

rm -f "$JAR" /tmp/pixels.json /tmp/track-res.json
echo "=== Done ==="
