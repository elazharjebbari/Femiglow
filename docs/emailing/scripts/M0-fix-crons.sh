#!/usr/bin/env bash
# ============================================================================
# M0 — Fix all femiglow-cron-*.service: add `-X POST` to curl
#
# Root cause : the unit files invoke `curl -sf ...` which defaults to GET,
# while all /api/cron/* route handlers only export POST → curl receives 405
# → exit code 22 → systemd marks the service as failed.
#
# This script :
#   1. Backs up the originals to /etc/systemd/system/femiglow-cron-backup-<ts>/
#   2. Adds `-X POST -d ''` to the ExecStart of all 18 unit files
#   3. systemctl daemon-reload + restart timers
#   4. Verifies that no femiglow-cron-* is in `failed` state
#
# Usage : run as root
#   sudo bash docs/emailing/scripts/M0-fix-crons.sh
#
# Safe : idempotent, dry-run capable (set DRY_RUN=1).
# ============================================================================
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "ERR: must run as root" >&2
  exit 1
fi

DRY_RUN="${DRY_RUN:-0}"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/etc/systemd/system/femiglow-cron-backup-${TS}"

UNITS=(
  /etc/systemd/system/femiglow-cron-analytics-refresh.service
  /etc/systemd/system/femiglow-cron-chat.service
  /etc/systemd/system/femiglow-cron-insights-purge.service
  /etc/systemd/system/femiglow-cron-media-optimize.service
  /etc/systemd/system/femiglow-cron-media-recover.service
  /etc/systemd/system/femiglow-cron-promote-scheduled-fields.service
  /etc/systemd/system/femiglow-cron-purge-field-history.service
  /etc/systemd/system/femiglow-cron-tick.service
  /etc/systemd/system/femiglow-cron-tracking-purge.service
  /etc/systemd/system/femiglow-staging-cron-analytics-refresh.service
  /etc/systemd/system/femiglow-staging-cron-chat.service
  /etc/systemd/system/femiglow-staging-cron-insights-purge.service
  /etc/systemd/system/femiglow-staging-cron-media-optimize.service
  /etc/systemd/system/femiglow-staging-cron-media-recover.service
  /etc/systemd/system/femiglow-staging-cron-promote-scheduled-fields.service
  /etc/systemd/system/femiglow-staging-cron-purge-field-history.service
  /etc/systemd/system/femiglow-staging-cron-tick.service
  /etc/systemd/system/femiglow-staging-cron-tracking-purge.service
)

echo "→ Backing up to ${BACKUP_DIR}"
if [[ "${DRY_RUN}" != "1" ]]; then
  mkdir -p "${BACKUP_DIR}"
  for u in "${UNITS[@]}"; do
    if [[ -f "${u}" ]]; then
      cp -a "${u}" "${BACKUP_DIR}/"
    fi
  done
fi

CHANGED=0
for u in "${UNITS[@]}"; do
  if [[ ! -f "${u}" ]]; then
    echo "  (skip, not found) ${u}"
    continue
  fi
  # Accept any -X METHOD (POST or GET) — the chat unit was repointed to GET
  # by M0-fix-cron-final.sh, and we mustn't add -X POST on top of it.
  if grep -qE '^ExecStart=/usr/bin/curl.*-X[[:space:]]+[A-Z]+' "${u}"; then
    echo "  (already fixed) ${u}"
    continue
  fi
  if ! grep -qE '^ExecStart=/usr/bin/curl -sf' "${u}"; then
    echo "  (unexpected ExecStart, manual review) ${u}"
    continue
  fi
  echo "  → patching ${u}"
  if [[ "${DRY_RUN}" != "1" ]]; then
    # Insert "-X POST" right after "/usr/bin/curl -sf"
    sed -i.bak \
      -e 's|^ExecStart=/usr/bin/curl -sf |ExecStart=/usr/bin/curl -sf -X POST |' \
      "${u}"
    rm -f "${u}.bak"
  fi
  CHANGED=$((CHANGED + 1))
done

echo ""
echo "→ ${CHANGED} unit file(s) patched."

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "DRY_RUN=1 → no changes applied. Exit."
  exit 0
fi

echo ""
echo "→ systemctl daemon-reload"
systemctl daemon-reload

echo ""
echo "→ Restarting timers (services are oneshot, no-op restart)"
for u in "${UNITS[@]}"; do
  unit_name="$(basename "${u}" .service).timer"
  if systemctl list-unit-files "${unit_name}" >/dev/null 2>&1; then
    systemctl restart "${unit_name}" || true
  fi
done

echo ""
echo "→ Waiting 70s for the next tick…"
sleep 70

echo ""
echo "→ Status verification (must show 0 failed femiglow-cron-*)"
FAILED=$(systemctl list-units --type=service --state=failed 2>/dev/null | grep -c "femiglow-cron-" || true)
echo "  failed femiglow-cron-* : ${FAILED}"

if [[ "${FAILED}" -gt 0 ]]; then
  echo ""
  echo "WARNING — some services still failed. Inspect with :"
  echo "  systemctl list-units --type=service --state=failed | grep femiglow-cron"
  echo "  journalctl -u femiglow-cron-tick.service --since '5 min ago' --no-pager | tail -30"
  exit 2
fi

echo ""
echo "✓ All femiglow-cron-* services healthy."
echo "  Backup of originals : ${BACKUP_DIR}"
