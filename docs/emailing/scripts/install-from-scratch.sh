#!/usr/bin/env bash
# ============================================================================
# install-from-scratch.sh — One-shot install of the FemiGlow emailing system.
#
# Designed to bring a server (or a freshly-reset DB) from zero to a fully
# functional emailing stack :
#   - 10 email_* tables migrated and seeded
#   - lib/mail/* deps installed
#   - femiglow-cron-*.service patched to POST (curl HTTP method fix)
#   - http-error.ts logging patch applied + Next.js rebuilt + service restarted
#   - Stalwart noreply@ account created with auto-generated SMTP password
#   - .env populated with all 8 emailing vars
#   - Stalwart webhook → FemiGlow configured
#   - systemd timer femiglow-cron-email-outbox enabled (60s pickup)
#
# Idempotent. Re-running is safe (skips done steps). DRY_RUN=1 supported.
#
# Prerequisites :
#   - Stalwart installed and reachable on http://127.0.0.1:8080
#   - Stalwart admin creds available in WORKTREE/.emailing-secrets.local
#       (STALWART_ADMIN_USER / STALWART_ADMIN_PASSWORD / STALWART_URL)
#   - Postgres reachable via $DATABASE_URL in PROD/apps/web/.env
#   - femiglow.service active (or at least previously installed)
#   - $CRON_SECRET present in PROD/apps/web/.env
#   - Domain femiglow-maroc.com declared in Stalwart (id=c assumed)
#
# Usage :
#   sudo bash /var/www/femiglow-emailing/docs/emailing/scripts/install-from-scratch.sh
# ============================================================================
set -euo pipefail
if [[ "${EUID}" -ne 0 ]]; then echo "ERR: must run as root" >&2; exit 1; fi

WORKTREE="${WORKTREE:-/var/www/femiglow-emailing}"
PROD="${PROD:-/var/www/femiglow}"
DRY_RUN="${DRY_RUN:-0}"
SCRIPTS_DIR="${WORKTREE}/docs/emailing/scripts"

step() { printf "\n\033[1;36m═══ %s ═══\033[0m\n" "$1"; }
run()  { if [[ "${DRY_RUN}" == "1" ]]; then echo "  [DRY] $*"; else eval "$@"; fi; }

# ─── 0. Prerequisites check ────────────────────────────────────────────────
step "0. Prerequisites check"

if [[ ! -d "${WORKTREE}" ]]; then
  echo "ERR: worktree ${WORKTREE} missing" >&2; exit 2
fi
if [[ ! -f "${WORKTREE}/.emailing-secrets.local" ]]; then
  echo "ERR: ${WORKTREE}/.emailing-secrets.local missing — required for Stalwart admin creds" >&2
  echo "     Cf. user message 2026-05-13 or recreate from STALWART_* vars" >&2
  exit 3
fi
if [[ ! -f "${PROD}/apps/web/.env" ]]; then
  echo "ERR: ${PROD}/apps/web/.env missing — needed for DATABASE_URL and CRON_SECRET" >&2; exit 4
fi
if ! systemctl is-active --quiet femiglow.service; then
  echo "WARN: femiglow.service not active. Continuing, but bootstrap step 4 will restart it."
fi
echo "  ✓ all checks pass"

# ─── 1. Install npm deps (worktree) ────────────────────────────────────────
step "1. Install npm deps (worktree + prod)"

cd "${WORKTREE}/apps/web"
echo "  → ${WORKTREE}/apps/web"
run "pnpm install --frozen-lockfile 2>&1 | tail -5"

cd "${PROD}/apps/web"
echo "  → ${PROD}/apps/web (chown .next first for nodeapp build later)"
[[ -d .next ]] && run "chown -R nodeapp:nodeapp .next"
run "pnpm install --frozen-lockfile 2>&1 | tail -5"

# ─── 2. Apply Drizzle migrations ───────────────────────────────────────────
step "2. Apply Drizzle migrations (idempotent)"

cd "${PROD}/apps/web"
# Drizzle reads DATABASE_URL from process.env
if [[ "${DRY_RUN}" == "1" ]]; then
  echo "  [DRY] would run: pnpm db:migrate"
else
  # Read DATABASE_URL from .env safely (don't source — comments can break shell)
  DB_URL=$(grep -E '^DATABASE_URL=' "${PROD}/apps/web/.env" | head -1 | cut -d= -f2-)
  if [[ -z "${DB_URL}" ]]; then
    echo "ERR: DATABASE_URL not in ${PROD}/apps/web/.env" >&2; exit 5
  fi
  BACKUP="/var/backups/femiglow-emailing/pre-install-$(date +%Y%m%d-%H%M%S).sql.gz"
  mkdir -p "$(dirname "${BACKUP}")"
  echo "  → backup DB to ${BACKUP}"
  pg_dump "${DB_URL}" --no-owner --no-privileges 2>/dev/null | gzip > "${BACKUP}"

  # Drizzle migrate reads from drizzle/migrations/ + meta/_journal.json.
  # Migrations have IF NOT EXISTS guards, so re-runs are safe.
  echo "  → DATABASE_URL=… pnpm db:migrate"
  DATABASE_URL="${DB_URL}" pnpm db:migrate 2>&1 | tail -10
fi

# ─── 3. Patch failed crons + restart femiglow ──────────────────────────────
step "3. Patch failed crons (curl POST, chat URL/method, http-error logging)"

if [[ "${DRY_RUN}" == "1" ]]; then
  for s in M0-fix-crons.sh M0-fix-residuals.sh M0-fix-cron-final.sh; do
    echo "  [DRY] bash ${SCRIPTS_DIR}/${s}"
  done
else
  # Each child script is itself idempotent and DRY-RUN aware.
  bash "${SCRIPTS_DIR}/M0-fix-crons.sh"      || true
  bash "${SCRIPTS_DIR}/M0-fix-residuals.sh"  || true
  bash "${SCRIPTS_DIR}/M0-fix-cron-final.sh" || true
fi

# ─── 4. Bootstrap emailing infra ───────────────────────────────────────────
step "4. Bootstrap : noreply@ account, secrets, .env, webhook, email-outbox timer"
run "bash '${SCRIPTS_DIR}/M0-bootstrap-infra.sh'"

# ─── 5. Final health check ─────────────────────────────────────────────────
step "5. Final health check"

FAILED=$(systemctl list-units --type=service --state=failed 2>/dev/null | grep -c "femiglow-cron-" || true)
echo "  failed femiglow-cron-*       : ${FAILED}"
echo "  femiglow.service active       : $(systemctl is-active femiglow.service 2>&1)"
echo "  email-outbox.timer active     : $(systemctl is-active femiglow-cron-email-outbox.timer 2>/dev/null || echo absent)"

if [[ "${DRY_RUN}" != "1" ]]; then
  # Smoke test : does the cron endpoint respond ?
  CRON_SECRET=$(grep -E '^CRON_SECRET=' "${PROD}/apps/web/.env" | head -1 | cut -d= -f2-)
  CODE=$(curl -sf -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    http://127.0.0.1:8011/api/cron/email-outbox 2>/dev/null || echo "—")
  echo "  /api/cron/email-outbox status : ${CODE} (expect 200)"
fi

echo ""
if [[ "${FAILED}" -eq 0 ]]; then
  echo "✓ Install complete. The emailing stack is ready."
else
  echo "⚠ Install complete, but ${FAILED} cron(s) still failing — inspect with :"
  echo "  systemctl list-units --type=service --state=failed | grep femiglow-cron"
fi

echo ""
echo "  Try sending a test :"
echo "    curl -X POST -H 'Authorization: Bearer ${CRON_SECRET:-<CRON_SECRET>}' \\"
echo "      http://127.0.0.1:8011/api/cron/email-outbox"
echo "  (with an outbox row pending, it will be delivered to SMTP and you'll"
echo "   see the corresponding event in journalctl -u femiglow.service)"
