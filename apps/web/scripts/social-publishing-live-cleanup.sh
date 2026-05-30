#!/usr/bin/env bash
# Live test cleanup — supprime les posts Postiz dangling marqués "[TEST AUTO"
# qui n'auraient pas été nettoyés par afterEach (crash, timeout, etc.).
#
# Usage:
#   POSTIZ_API_KEY=xxx ./scripts/social-publishing-live-cleanup.sh
#
# Optionnel:
#   POSTIZ_BASE_URL (default https://api.postiz.com)
#   AGE_MINUTES — supprime les posts test plus vieux que N minutes (default 60)

set -euo pipefail

POSTIZ_BASE="${POSTIZ_BASE_URL:-https://api.postiz.com}"
AGE_MIN="${AGE_MINUTES:-60}"

if [ -z "${POSTIZ_API_KEY:-}" ]; then
  echo "ERROR: POSTIZ_API_KEY required" >&2
  exit 1
fi

# Date threshold ISO8601
CUTOFF=$(date -u -d "${AGE_MIN} minutes ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
  || date -u -v -"${AGE_MIN}M" +%Y-%m-%dT%H:%M:%SZ)

echo "Cleaning Postiz test posts older than ${CUTOFF} ..."

# Fetch all posts in the last 24h, filter by "[TEST AUTO" marker
START=$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
  || date -u -v -24H +%Y-%m-%dT%H:%M:%SZ)
END=$(date -u +%Y-%m-%dT%H:%M:%SZ)

curl -sS -H "authorization: ${POSTIZ_API_KEY}" \
  "${POSTIZ_BASE}/api/public/v1/posts?startDate=${START}&endDate=${END}" \
  | jq -r --arg cutoff "$CUTOFF" '
    .[] | select(.content // "" | test("\\[TEST AUTO"))
        | select(.createdAt < $cutoff)
        | .id' 2>/dev/null \
  | while read -r POST_ID; do
      [ -z "$POST_ID" ] && continue
      RES=$(curl -sS -o /dev/null -w "%{http_code}" -X DELETE \
        -H "authorization: ${POSTIZ_API_KEY}" \
        "${POSTIZ_BASE}/api/public/v1/posts/${POST_ID}")
      echo "Deleted test post ${POST_ID} → HTTP ${RES}"
    done

echo "Cleanup done."
