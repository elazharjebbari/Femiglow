#!/usr/bin/env bash
# ============================================================================
# M0 — FINAL fix: apply code patches + chat method + rebuild + restart.
#
# Pre-requisites :
#   - You're on branch emailing-system, commit 66a02c0 or later
#   - The earlier M0-fix-crons.sh and M0-fix-residuals.sh ran successfully
#
# What this does :
#   A. Repoint femiglow-cron-chat unit files to GET (route exports GET, not POST)
#   B. Copy the 2 code patches (media-jobs.ts + tracking/events-log.ts) from
#      the worktree to the prod tree
#   C. Rebuild prod, restart femiglow.service
#   D. Trigger the 3 services and report
# ============================================================================
set -euo pipefail
if [[ "${EUID}" -ne 0 ]]; then echo "ERR: must run as root" >&2; exit 1; fi

WORKTREE="${WORKTREE:-/var/www/femiglow-emailing}"
PROD="${PROD:-/var/www/femiglow}"
DRY_RUN="${DRY_RUN:-0}"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/etc/systemd/system/femiglow-cron-backup-${TS}"

run() { if [[ "${DRY_RUN}" == "1" ]]; then echo "  [DRY] $*"; else eval "$@"; fi; }

echo "→ Backups → ${BACKUP_DIR}"
run "mkdir -p '${BACKUP_DIR}'"
for f in \
  /etc/systemd/system/femiglow-cron-chat.service \
  /etc/systemd/system/femiglow-staging-cron-chat.service \
  "${PROD}/apps/web/src/lib/db/queries/media-jobs.ts" \
  "${PROD}/apps/web/src/lib/db/queries/tracking/events-log.ts"
do
  [[ -f "${f}" ]] && run "cp -a '${f}' '${BACKUP_DIR}/$(echo "${f}" | tr / _)'"
done

# ─────────────────────────────────────────────────────────────────────────────
# A. Chat: POST → GET (route exports GET)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "→ A. Fix chat method: POST → GET (route exports GET, not POST)"
for f in /etc/systemd/system/femiglow-cron-chat.service /etc/systemd/system/femiglow-staging-cron-chat.service; do
  if [[ ! -f "${f}" ]]; then continue; fi
  if grep -q -- '-X GET' "${f}"; then echo "  (already GET) ${f}"; continue; fi
  echo "  → ${f}"
  run "sed -i 's|-X POST|-X GET|' '${f}'"
done

# ─────────────────────────────────────────────────────────────────────────────
# B. Copy code patches to prod
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "→ B. Copy patched files from worktree to prod"
for rel in src/lib/db/queries/media-jobs.ts src/lib/db/queries/tracking/events-log.ts; do
  src="${WORKTREE}/apps/web/${rel}"
  dst="${PROD}/apps/web/${rel}"
  if ! diff -q "${src}" "${dst}" >/dev/null 2>&1; then
    echo "  → ${dst}"
    run "cp -a '${src}' '${dst}'"
  else
    echo "  (identical, skip) ${dst}"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# C. Rebuild + restart
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "→ C. chown .next + rebuild + restart"
if [[ "${DRY_RUN}" == "1" ]]; then
  echo "  [DRY] chown -R nodeapp:nodeapp ${PROD}/apps/web/.next"
  echo "  [DRY] sudo -u nodeapp pnpm build (in ${PROD}/apps/web)"
  echo "  [DRY] systemctl daemon-reload && systemctl restart femiglow.service"
else
  if [[ -d "${PROD}/apps/web/.next" ]]; then
    chown -R nodeapp:nodeapp "${PROD}/apps/web/.next"
  fi
  cd "${PROD}/apps/web"
  if ! sudo -u nodeapp pnpm build 2>&1 | tail -10; then
    echo "ERR: build failed"
    exit 3
  fi
  systemctl daemon-reload
  systemctl restart femiglow.service
  sleep 5
  if ! systemctl is-active --quiet femiglow.service; then
    echo "ERR: femiglow.service did not come back active"
    exit 4
  fi
  echo "  femiglow.service active ✓"
fi

# ─────────────────────────────────────────────────────────────────────────────
# D. Trigger + report
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "→ D. Trigger 3 services + report"
sleep 2
for svc in femiglow-cron-chat.service femiglow-cron-media-optimize.service femiglow-cron-tracking-purge.service; do
  run "systemctl reset-failed '${svc}' 2>/dev/null || true"
  run "systemctl start '${svc}' || true"
done
sleep 3

if [[ "${DRY_RUN}" == "1" ]]; then exit 0; fi

echo ""
FAILED=$(systemctl list-units --type=service --state=failed 2>/dev/null | grep -c "femiglow-cron-" || true)
echo "  failed femiglow-cron-* : ${FAILED}"
if [[ "${FAILED}" -eq 0 ]]; then
  echo "✓ All femiglow-cron-* services healthy."
else
  echo "  Remaining stacks :"
  journalctl -u femiglow.service --since "30 seconds ago" --no-pager 2>&1 \
    | grep -A 20 "http-error.unexpected" | tail -40
fi
