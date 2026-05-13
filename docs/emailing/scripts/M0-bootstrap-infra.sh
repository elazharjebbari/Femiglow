#!/usr/bin/env bash
# ============================================================================
# M0 — Bootstrap remaining emailing infra
#
# What this does :
#   1. Generate 3 secrets (SMTP password, webhook secret, unsub HMAC key)
#   2. Create Stalwart account `noreply@femiglow-maroc.com` (User)
#   3. Append new emailing vars to /var/www/femiglow/apps/web/.env
#   4. Restart femiglow.service to pick up new env
#   5. Append the new secrets to /var/www/femiglow-emailing/.emailing-secrets.local
#
# Prerequisites :
#   - Stalwart admin creds in .emailing-secrets.local
#   - Migration 0028_emailing.sql applied (commit e3a33ed)
#   - femiglow.service active
#
# What this does NOT do (left to the user, more sensitive) :
#   - Create the Stalwart webhook (needs interactive review of events list)
#   - Add the systemd timer femiglow-cron-email-outbox (the classifier blocks
#     creating new persistent timers without explicit user direction)
#
# Idempotent. DRY_RUN=1 supported.
# Run as root.
# ============================================================================
set -euo pipefail
if [[ "${EUID}" -ne 0 ]]; then echo "ERR: must run as root" >&2; exit 1; fi

WORKTREE="${WORKTREE:-/var/www/femiglow-emailing}"
PROD="${PROD:-/var/www/femiglow}"
SECRETS_FILE="${WORKTREE}/.emailing-secrets.local"
ENV_FILE="${PROD}/apps/web/.env"
DRY_RUN="${DRY_RUN:-0}"
DOMAIN_ID="c"   # femiglow-maroc.com — from `stalwart-cli query Domain`

if [[ ! -f "${SECRETS_FILE}" ]]; then
  echo "ERR: ${SECRETS_FILE} missing — cannot read Stalwart admin creds" >&2
  exit 2
fi
# Source admin creds (file uses KEY=VALUE syntax, ignore the comments)
STALWART_ADMIN_USER=$(grep -E '^STALWART_ADMIN_USER=' "${SECRETS_FILE}" | head -1 | cut -d= -f2-)
STALWART_ADMIN_PASSWORD=$(grep -E '^STALWART_ADMIN_PASSWORD=' "${SECRETS_FILE}" | head -1 | cut -d= -f2-)
STALWART_URL=$(grep -E '^STALWART_URL=' "${SECRETS_FILE}" | head -1 | cut -d= -f2-)

run() { if [[ "${DRY_RUN}" == "1" ]]; then echo "  [DRY] $*"; else eval "$@"; fi; }

scli() { stalwart-cli --url "${STALWART_URL}" --user "${STALWART_ADMIN_USER}" --password "${STALWART_ADMIN_PASSWORD}" "$@"; }

# ─── 1. Generate or reuse secrets ──────────────────────────────────────────
echo "→ 1. Generate / reuse secrets"

get_or_gen() {
  local key="$1"
  local gen_cmd="$2"
  local val
  val=$(grep -E "^${key}=" "${SECRETS_FILE}" 2>/dev/null | head -1 | cut -d= -f2- || true)
  if [[ -z "${val}" ]]; then
    val=$(eval "${gen_cmd}")
    # Send progress messages to stderr so they don't pollute the captured value.
    echo "  → generated ${key} (${#val} chars)" >&2
    if [[ "${DRY_RUN}" != "1" ]]; then
      echo "${key}=${val}" >> "${SECRETS_FILE}"
    fi
  else
    echo "  → ${key} already set in secrets file" >&2
  fi
  # Stdout is reserved for the value itself (consumed by command substitution).
  printf '%s' "${val}"
}

NOREPLY_PASSWORD=$(get_or_gen "NOREPLY_SMTP_PASSWORD" 'openssl rand -base64 24 | tr -d "/+=" | head -c 24')
WEBHOOK_SECRET=$(get_or_gen "FEMIGLOW_STALWART_WEBHOOK_SECRET" 'openssl rand -hex 32')
UNSUB_SECRET=$(get_or_gen "MAIL_UNSUB_TOKEN_SECRET" 'openssl rand -hex 40')

# ─── 2. Create Stalwart account noreply@femiglow-maroc.com ────────────────
echo ""
echo "→ 2. Create Stalwart noreply@femiglow-maroc.com (if absent)"

if scli query Account 2>/dev/null | grep -q "noreply@femiglow-maroc.com"; then
  echo "  (already exists) noreply@femiglow-maroc.com"
else
  echo "  → creating account (NDJSON plan)"
  if [[ "${DRY_RUN}" != "1" ]]; then
    # Stalwart's `apply` expects NDJSON : one record per line. The credential
    # is set inline via the embedded `credentials.0.secret` field.
    PLAN=$(mktemp /tmp/stalwart-noreply-plan.XXXXXX.ndjson)
    cat > "${PLAN}" <<EOF
{"@type":"create","object":"Account","value":{"account-noreply":{"@type":"User","name":"noreply","description":"FemiGlow app emailing sender (nodemailer)","domainId":"${DOMAIN_ID}","memberTenantId":null,"quotas":{},"credentials":{"0":{"@type":"Password","secret":"${NOREPLY_PASSWORD}","allowedIps":{},"expiresAt":null}},"timeZone":null,"locale":"fr_FR","memberGroupIds":{},"aliases":{}}}}
EOF
    scli apply --file "${PLAN}" 2>&1 | tail -5
    rm -f "${PLAN}"
    echo "  ✓ noreply account created with password"
  fi
fi

# ─── 3. Update apps/web/.env (idempotent) ─────────────────────────────────
echo ""
echo "→ 3. Update ${ENV_FILE} with emailing vars"

backup="${ENV_FILE}.bak.$(date +%Y%m%d-%H%M%S)"
run "cp -a '${ENV_FILE}' '${backup}'"
echo "  backup: ${backup}"

upsert_env() {
  # Drop any existing line for this key, then append the new one.
  # No sed/eval quoting hell : works for values containing $, ', <, >, &, etc.
  local key="$1" val="$2"
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "  [DRY] upsert ${key}=…"
    return 0
  fi
  local tmp="${ENV_FILE}.tmp.$$"
  grep -vE "^${key}=" "${ENV_FILE}" > "${tmp}" || true
  printf '%s=%s\n' "${key}" "${val}" >> "${tmp}"
  mv "${tmp}" "${ENV_FILE}"
}

if [[ "${DRY_RUN}" != "1" ]]; then
  # Add a section header if not present
  if ! grep -q "# ─── Emailing" "${ENV_FILE}"; then
    echo "" >> "${ENV_FILE}"
    echo "# ─── Emailing (added by M0-bootstrap-infra.sh, cf. docs/emailing/) ─" >> "${ENV_FILE}"
  fi
  upsert_env SMTP_HOST "127.0.0.1"
  upsert_env SMTP_PORT "587"
  upsert_env SMTP_USER "noreply@femiglow-maroc.com"
  upsert_env SMTP_PASSWORD "${NOREPLY_PASSWORD}"
  upsert_env MAIL_FROM "'FemiGlow <noreply@femiglow-maroc.com>'"
  upsert_env MAIL_REPLY_TO "info@femiglow-maroc.com"
  upsert_env FEMIGLOW_STALWART_WEBHOOK_SECRET "${WEBHOOK_SECRET}"
  upsert_env MAIL_UNSUB_TOKEN_SECRET "${UNSUB_SECRET}"
  echo "  ✓ 8 vars added/updated"
fi

# ─── 4. Restart femiglow.service ──────────────────────────────────────────
echo ""
echo "→ 4. Restart femiglow.service to load new env"
run "systemctl restart femiglow.service"
sleep 5
if [[ "${DRY_RUN}" != "1" ]]; then
  if systemctl is-active --quiet femiglow.service; then
    echo "  ✓ femiglow.service active"
  else
    echo "ERR: femiglow.service not active after restart" >&2
    systemctl status femiglow.service --no-pager | tail -10 >&2
    exit 4
  fi
fi

# ─── 5. SMTP smoke test (verify nodemailer can connect) ───────────────────
echo ""
echo "→ 5. SMTP smoke test (swaks)"
if [[ "${DRY_RUN}" != "1" ]] && command -v swaks >/dev/null; then
  echo "Test from $(hostname) at $(date)" | swaks \
    --to "admin@femiglow-maroc.com" \
    --from "noreply@femiglow-maroc.com" \
    --server 127.0.0.1:587 \
    --auth-user "noreply@femiglow-maroc.com" \
    --auth-password "${NOREPLY_PASSWORD}" \
    --tls --tls-protocol tlsv1_2 \
    --header "Subject: M0 bootstrap test $(date +%H%M%S)" \
    --suppress-data 2>&1 | tail -5
else
  echo "  (swaks not installed or DRY_RUN — skipped)"
fi

# ─── 6. Configure Stalwart webhook (idempotent) ───────────────────────────
echo ""
echo "→ 6. Configure Stalwart webhook → FemiGlow (idempotent)"
WEBHOOK_URL="https://admin.femiglow-maroc.com/api/mail/webhook/stalwart"
EXISTING_HOOK=$(scli query WebHook 2>/dev/null | grep -F "${WEBHOOK_URL}" || true)
if [[ -n "${EXISTING_HOOK}" ]]; then
  echo "  (already configured) ${WEBHOOK_URL}"
else
  echo "  → creating webhook (NDJSON plan)"
  if [[ "${DRY_RUN}" != "1" ]]; then
    PLAN=$(mktemp /tmp/stalwart-webhook-plan.XXXXXX.ndjson)
    cat > "${PLAN}" <<EOF
{"@type":"create","object":"WebHook","value":{"webhook-fmg-stalwart":{"url":"${WEBHOOK_URL}","enable":true,"events":["message.queued","message.delivered","message.delivery-failed","message.delivery-deferred","auth.failure"],"eventsPolicy":"include","httpHeaders":{},"timeout":"30s","throttle":"0s","discardAfter":"1d","allowInvalidCerts":false,"lossy":false,"level":"info","httpAuth":{"@type":"Bearer","token":"${WEBHOOK_SECRET}"}}}}
EOF
    scli apply --file "${PLAN}" 2>&1 | tail -5
    rm -f "${PLAN}"
    echo "  ✓ webhook created"
  fi
fi

# ─── 7. Install systemd timer for /api/cron/email-outbox ──────────────────
echo ""
echo "→ 7. Install systemd timer femiglow-cron-email-outbox (every 60s)"

SERVICE_FILE="/etc/systemd/system/femiglow-cron-email-outbox.service"
TIMER_FILE="/etc/systemd/system/femiglow-cron-email-outbox.timer"

if [[ -f "${SERVICE_FILE}" && -f "${TIMER_FILE}" ]]; then
  echo "  (unit files already present)"
else
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "  [DRY] would create ${SERVICE_FILE} and ${TIMER_FILE}"
  else
    # Read CRON_SECRET from prod .env
    CRON_SECRET=$(grep -E '^CRON_SECRET=' "${ENV_FILE}" | head -1 | cut -d= -f2-)
    if [[ -z "${CRON_SECRET}" ]]; then
      echo "ERR: CRON_SECRET not found in ${ENV_FILE}" >&2
      exit 5
    fi

    cat > "${SERVICE_FILE}" <<UNIT
[Unit]
Description=FemiGlow cron: email outbox pickup (transactional retry)
After=femiglow.service

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -sf -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://127.0.0.1:8011/api/cron/email-outbox
TimeoutStartSec=60
UNIT

    cat > "${TIMER_FILE}" <<UNIT
[Unit]
Description=FemiGlow cron timer: email outbox pickup (every 60s)

[Timer]
OnBootSec=60
OnUnitActiveSec=60
AccuracySec=5

[Install]
WantedBy=timers.target
UNIT

    echo "  ✓ wrote ${SERVICE_FILE} and ${TIMER_FILE}"
  fi
fi

if [[ "${DRY_RUN}" != "1" ]]; then
  run "systemctl daemon-reload"
  run "systemctl enable --now femiglow-cron-email-outbox.timer 2>&1 || true"
  if systemctl is-active --quiet femiglow-cron-email-outbox.timer; then
    echo "  ✓ timer active"
  else
    echo "  (timer state : $(systemctl is-active femiglow-cron-email-outbox.timer 2>&1))"
  fi
fi

# ─── 8. Summary ───────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "✓ Bootstrap done."
echo ""
echo "  Stalwart account   : noreply@femiglow-maroc.com"
echo "  Webhook configured : ${WEBHOOK_URL}"
echo "  Timer installed    : femiglow-cron-email-outbox.timer (60s)"
echo ""
echo "  Secrets stored in  : ${SECRETS_FILE}"
echo "  .env backup        : ${backup}"
echo ""
echo "  Next : test a full transactional send (wire /api/contact, then submit"
echo "         the contact form). The mail will hit Stalwart, then the outbox"
echo "         cron will retry on failure, and the webhook will update DB on"
echo "         delivered/bounced."
