#!/usr/bin/env bash
# ============================================================================
# M0 — Fix the 3 residual failed crons after M0-fix-crons.sh
#
# Problems identified post first fix :
#   1. femiglow-cron-chat.service          → 404 (URL mismatch)
#   2. femiglow-cron-media-optimize.service → 500 (unknown, needs logging)
#   3. femiglow-cron-tracking-purge.service → 500 (unknown, needs logging)
#
# Strategy :
#   A. Fix chat URL : point at /api/cron/chat/purge (RGPD daily) instead of
#      /api/cron/chat which never existed. Same for staging.
#   B. Patch lib/errors/http-error.ts to LOG non-HttpError before returning
#      "Erreur interne" — that's why we don't see the stack traces.
#   C. Rebuild + restart, then trigger the 2 failing services to capture stacks.
#
# Usage :
#   sudo bash docs/emailing/scripts/M0-fix-residuals.sh
#
# Idempotent. DRY_RUN=1 supported.
# ============================================================================
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "ERR: must run as root" >&2
  exit 1
fi

DRY_RUN="${DRY_RUN:-0}"
WORKTREE="${WORKTREE:-/var/www/femiglow}"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/etc/systemd/system/femiglow-cron-backup-${TS}"

run() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "  [DRY] $*"
  else
    eval "$@"
  fi
}

echo "→ Backup current state to ${BACKUP_DIR}"
run "mkdir -p '${BACKUP_DIR}'"
for f in \
  /etc/systemd/system/femiglow-cron-chat.service \
  /etc/systemd/system/femiglow-staging-cron-chat.service \
  /etc/systemd/system/femiglow-cron-chat-purge.service \
  /etc/systemd/system/femiglow-cron-chat-billing-reset.service \
  "${WORKTREE}/apps/web/src/lib/errors/http-error.ts" \
  "${WORKTREE}/apps/web/src/app/api/cron/media-optimize/route.ts" \
  "${WORKTREE}/apps/web/src/app/api/cron/tracking-purge/route.ts"
do
  if [[ -f "${f}" ]]; then
    run "cp -a '${f}' '${BACKUP_DIR}/$(echo "${f}" | tr / _)'"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# A. Repoint chat unit files to /api/cron/chat/purge
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "→ A. Repointing chat URLs to /api/cron/chat/purge"
for f in /etc/systemd/system/femiglow-cron-chat.service /etc/systemd/system/femiglow-staging-cron-chat.service; do
  if [[ ! -f "${f}" ]]; then echo "  (skip, missing) ${f}"; continue; fi
  if grep -qE 'api/cron/chat/purge' "${f}"; then
    echo "  (already fixed) ${f}"
    continue
  fi
  echo "  → ${f}"
  run "sed -i 's|api/cron/chat\\([\"[:space:]]\\)|api/cron/chat/purge\\1|' '${f}'"
done

# Clean up orphan unit files (we wrote them earlier but they have no timer).
for orphan in \
  /etc/systemd/system/femiglow-cron-chat-purge.service \
  /etc/systemd/system/femiglow-cron-chat-billing-reset.service
do
  if [[ -f "${orphan}" ]]; then
    echo "  → removing orphan unit ${orphan}"
    run "rm -f '${orphan}'"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# B. Patch lib/errors/http-error.ts to log non-HttpError before returning 500
# ─────────────────────────────────────────────────────────────────────────────
HTTP_ERR_TS="${WORKTREE}/apps/web/src/lib/errors/http-error.ts"
echo ""
echo "→ B. Patching ${HTTP_ERR_TS} to log non-HttpError before returning 500"

if grep -q "console.error('http-error.unexpected'" "${HTTP_ERR_TS}"; then
  echo "  (already patched)"
else
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "  [DRY] would patch ${HTTP_ERR_TS}"
  else
    # Insert console.error call right before the final `return { status: 500, ... }`
    python3 - "${HTTP_ERR_TS}" <<'PY'
import re, sys
p = sys.argv[1]
src = open(p).read()
old = "  return {\n    status: 500,\n    body: { error: { code: 'internal_error', message: 'Erreur interne' } },\n  };\n}"
new = "  // Log non-HttpError before swallowing — added by M0-fix-residuals.sh\n  console.error('http-error.unexpected', err instanceof Error ? { message: err.message, stack: err.stack, name: err.name } : err);\n  return {\n    status: 500,\n    body: { error: { code: 'internal_error', message: 'Erreur interne' } },\n  };\n}"
if old not in src:
    print("PATCH_FAILED: expected block not found in", p, file=sys.stderr)
    sys.exit(2)
open(p, 'w').write(src.replace(old, new))
print("  patched ok")
PY
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# C. Rebuild + restart + capture stacks
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "→ C. Rebuilding & restarting femiglow.service"

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "  [DRY] would run: chown -R nodeapp:nodeapp .next (writable by build user)"
  echo "  [DRY] would run: cd ${WORKTREE}/apps/web && pnpm build"
  echo "  [DRY] would run: systemctl daemon-reload && systemctl restart femiglow.service"
else
  cd "${WORKTREE}/apps/web"
  # Pre-requisite : nodeapp must own .next/ to write trace, cache, build output.
  # The runtime EACCES errors on .next/cache/fetch-cache/* confirm the owner
  # is currently root from a prior build.
  echo "  → chown -R nodeapp:nodeapp .next (+ .media-storage if present)"
  if [[ -d .next ]]; then
    chown -R nodeapp:nodeapp .next
  fi
  if [[ -d .media-storage ]]; then
    chown -R nodeapp:nodeapp .media-storage 2>/dev/null || true
  fi
  # Also ensure node_modules is readable by nodeapp (typically already is via
  # group, but harmless to assert).
  if [[ -d node_modules ]]; then
    chown -R nodeapp:nodeapp node_modules 2>/dev/null || true
  fi
  if ! sudo -u nodeapp pnpm build 2>&1 | tail -20; then
    echo "ERR: build failed, aborting before restart"
    echo "  Hint : check ownership again, or try removing .next and rebuilding from scratch :"
    echo "    sudo rm -rf .next && sudo chown -R nodeapp:nodeapp . && sudo -u nodeapp pnpm build"
    exit 3
  fi
  systemctl daemon-reload
  systemctl restart femiglow.service
  sleep 5
  if ! systemctl is-active --quiet femiglow.service; then
    echo "ERR: femiglow.service did not come back active after restart"
    systemctl status femiglow.service --no-pager | tail -20
    exit 4
  fi
  echo "  femiglow.service active ✓"
fi

echo ""
echo "→ Triggering the 3 services to validate"
sleep 2
for svc in femiglow-cron-chat.service femiglow-cron-media-optimize.service femiglow-cron-tracking-purge.service; do
  run "systemctl reset-failed '${svc}' 2>/dev/null || true"
  run "systemctl start '${svc}' || true"
  sleep 2
  echo "  ── ${svc} ──"
  if [[ "${DRY_RUN}" != "1" ]]; then
    systemctl status "${svc}" --no-pager 2>&1 | grep -E "Active|status=" | head -2
  fi
done

if [[ "${DRY_RUN}" == "1" ]]; then
  echo ""
  echo "DRY_RUN=1 → no changes applied."
  exit 0
fi

echo ""
echo "→ Capturing recent error logs (after the 3 triggers above)"
journalctl -u femiglow.service --since "30 seconds ago" --no-pager 2>&1 \
  | grep -iE "http-error.unexpected|error|EACCES|ENOENT" \
  | tail -30

echo ""
echo "→ Final state"
FAILED=$(systemctl list-units --type=service --state=failed 2>/dev/null | grep -c "femiglow-cron-" || true)
echo "  failed femiglow-cron-* : ${FAILED}"

if [[ "${FAILED}" -eq 0 ]]; then
  echo "✓ All femiglow-cron-* services healthy."
else
  echo ""
  echo "Remaining failures — look at the captured stack traces above to find root cause."
  echo "Then either :"
  echo "  - apply the targeted code fix (likely in lib/db/queries/tracking/events-log.ts or lib/media/worker/*)"
  echo "  - or, if these jobs are not needed in prod, disable their timers :"
  echo "    sudo systemctl disable --now femiglow-cron-media-optimize.timer"
  echo "    sudo systemctl disable --now femiglow-cron-tracking-purge.timer"
fi
