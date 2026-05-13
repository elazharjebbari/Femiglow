#!/bin/bash
# ============================================================================
# smoke-event-mappings.sh — Smoke tests post-deploy event mappings
# ----------------------------------------------------------------------------
# Usage : bash scripts/smoke-event-mappings.sh [base_url]
# cf. docs/event-mappings/80-runbook/smoke-tests.md
# ============================================================================
set -e

BASE_URL=${1:-http://127.0.0.1:8011}
EMAIL=${ADMIN_EMAIL:-$(grep ^ADMIN_BOOTSTRAP_EMAIL apps/web/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || echo '')}
PASS=${ADMIN_PASS:-$(grep ^ADMIN_BOOTSTRAP_PASSWORD apps/web/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || echo '')}

echo "=== Smoke event-mappings on $BASE_URL ==="

if [ -z "$EMAIL" ] || [ -z "$PASS" ]; then
  echo "SKIP login (no ADMIN_BOOTSTRAP_* in env)"
  exit 0
fi

JAR=$(mktemp)
echo "--- Admin login ---"
curl -sS -c "$JAR" -X POST "$BASE_URL/api/admin/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  -o /dev/null -w 'login: HTTP %{http_code}\n'

echo "--- 1. GET /api/admin/tracking/events/mappings ---"
curl -sS -b "$JAR" "$BASE_URL/api/admin/tracking/events/mappings" -o /tmp/em-list.json -w 'HTTP %{http_code}\n'
ACTIVE_ID=$(jq -r '.activeId' /tmp/em-list.json)
DEFAULT_ID=$(jq -r '.defaultId' /tmp/em-list.json)
echo "  activeId: $ACTIVE_ID"
echo "  defaultId: $DEFAULT_ID"
echo "  versions count: $(jq '.versions | length' /tmp/em-list.json)"

echo "--- 2. GET /api/admin/tracking/events/mappings/__default__ ---"
curl -sS -b "$JAR" "$BASE_URL/api/admin/tracking/events/mappings/__default__" -o /tmp/em-default.json -w 'HTTP %{http_code}\n'
echo "  events: $(jq '.mappings | keys | length' /tmp/em-default.json)"
echo "  purchase.meta.mappedName: $(jq -r '.mappings.purchase.meta.mappedName' /tmp/em-default.json)"

echo "--- 3. POST /api/admin/tracking/events/mappings/__default__/test ---"
curl -sS -b "$JAR" -X POST "$BASE_URL/api/admin/tracking/events/mappings/__default__/test" \
  -H 'Content-Type: application/json' \
  -d '{"eventName":"purchase"}' \
  -o /tmp/em-test.json -w 'HTTP %{http_code}\n'
echo "  meta.wouldDispatch: $(jq -r '.results.meta.wouldDispatch' /tmp/em-test.json)"
echo "  meta.mappedName: $(jq -r '.results.meta.mappedName' /tmp/em-test.json)"
echo "  tiktok.mappedName: $(jq -r '.results.tiktok.mappedName' /tmp/em-test.json)"

echo "--- 4. POST /api/admin/tracking/events/mappings/__default__/export-gtm ---"
curl -sS -b "$JAR" -X POST "$BASE_URL/api/admin/tracking/events/mappings/__default__/export-gtm" \
  -H 'Content-Type: application/json' \
  -d '{"env":"production"}' \
  -o /tmp/em-export.json -w 'HTTP %{http_code}\n'
echo "  sha256: $(jq -r '.meta.sha256' /tmp/em-export.json)"
echo "  tagsCount: $(jq -r '.meta.tagsCount' /tmp/em-export.json)"
echo "  exportFormatVersion: $(jq -r '.containerJson.exportFormatVersion' /tmp/em-export.json)"
echo "  triggers: $(jq -r '.containerJson.containerVersion.trigger | length' /tmp/em-export.json)"

echo "--- 5. DB integrity ---"
DATABASE_URL=$(grep ^DATABASE_URL apps/web/.env | head -1 | cut -d= -f2- | tr -d '"')
psql "$DATABASE_URL" -c "
  SELECT 'versions_total' as t, count(*) FROM event_mapping_versions
  UNION ALL SELECT 'versions_active', count(*) FROM event_mapping_versions WHERE is_active = true
  UNION ALL SELECT 'versions_default', count(*) FROM event_mapping_versions WHERE is_default = true
  UNION ALL SELECT 'audit_24h', count(*) FROM event_mapping_audit WHERE created_at >= now() - interval '24 hours'
" 2>&1 | head -10

rm -f "$JAR" /tmp/em-list.json /tmp/em-default.json /tmp/em-test.json /tmp/em-export.json
echo "=== Done ==="
