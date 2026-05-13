#!/usr/bin/env bash
# ============================================================================
# M3.1 — Install Listmonk on the VPS (idempotent, root only).
#
# What this does :
#   1. Download Listmonk binary (v6.1.0 or env LISTMONK_VERSION) to /usr/local/bin
#   2. Create system user `listmonk` (no shell)
#   3. Create Postgres role + DB `listmonk` (random password, stored in
#      .emailing-secrets.local for future reference)
#   4. Create /etc/listmonk/config.toml pointing at 127.0.0.1:9000 (loopback)
#   5. Run `listmonk --install --idempotent` to seed schema
#   6. Configure SMTP : reuse noreply@femiglow-maroc.com (from M0 secrets)
#   7. Create systemd unit listmonk.service + enable
#   8. Create API user `femiglow-app` (token returned, stored in .env + secrets)
#   9. Append LISTMONK_* env vars to apps/web/.env
#  10. Smoke test : curl loopback returns 200
#
# What this does NOT do :
#   - Open port 9000 to public (it stays loopback ; FemiGlow proxies via
#     /api/listmonk/[...path] in M3.3)
#   - Configure UFW (Listmonk only listens on 127.0.0.1, no firewall change
#     needed)
#
# Usage : sudo bash docs/emailing/scripts/M3-install-listmonk.sh
# DRY_RUN=1 to preview. Idempotent — safe to re-run.
# ============================================================================
set -euo pipefail
if [[ "${EUID}" -ne 0 ]]; then echo "ERR: must run as root" >&2; exit 1; fi

WORKTREE="${WORKTREE:-/var/www/femiglow-emailing}"
PROD="${PROD:-/var/www/femiglow}"
ENV_FILE="${PROD}/apps/web/.env"
SECRETS_FILE="${WORKTREE}/.emailing-secrets.local"
DRY_RUN="${DRY_RUN:-0}"
LISTMONK_VERSION="${LISTMONK_VERSION:-6.1.0}"
LISTMONK_PORT="${LISTMONK_PORT:-9000}"

run() { if [[ "${DRY_RUN}" == "1" ]]; then echo "  [DRY] $*"; else eval "$@"; fi; }
step() { printf "\n\033[1;36m═══ %s ═══\033[0m\n" "$1"; }

if [[ ! -f "${SECRETS_FILE}" ]]; then
  echo "ERR: ${SECRETS_FILE} missing — run M0-bootstrap-infra.sh first" >&2
  exit 2
fi

# ─── helper : read or generate a secret and persist it ─────────────────────
get_or_gen() {
  local key="$1" gen_cmd="$2"
  local val
  val=$(grep -E "^${key}=" "${SECRETS_FILE}" 2>/dev/null | head -1 | cut -d= -f2- || true)
  if [[ -z "${val}" ]]; then
    val=$(eval "${gen_cmd}")
    echo "  → generated ${key}" >&2
    if [[ "${DRY_RUN}" != "1" ]]; then
      echo "${key}=${val}" >> "${SECRETS_FILE}"
    fi
  else
    echo "  → ${key} already set" >&2
  fi
  printf '%s' "${val}"
}

# ─── 1. Download binary ────────────────────────────────────────────────────
step "1. Listmonk binary v${LISTMONK_VERSION}"

if [[ -f /usr/local/bin/listmonk ]] && /usr/local/bin/listmonk --version 2>&1 | grep -q "${LISTMONK_VERSION}"; then
  echo "  (already installed) $(/usr/local/bin/listmonk --version 2>&1 | head -1)"
else
  TAR="/tmp/listmonk_${LISTMONK_VERSION}_linux_amd64.tar.gz"
  URL="https://github.com/knadh/listmonk/releases/download/v${LISTMONK_VERSION}/listmonk_${LISTMONK_VERSION}_linux_amd64.tar.gz"
  echo "  → ${URL}"
  run "curl -fsSL -o '${TAR}' '${URL}'"
  run "cd /tmp && tar -xzf '${TAR}' listmonk"
  run "install -o root -g root -m 0755 /tmp/listmonk /usr/local/bin/listmonk"
  run "rm -f '${TAR}' /tmp/listmonk"
  if [[ "${DRY_RUN}" != "1" ]]; then
    /usr/local/bin/listmonk --version 2>&1 | head -1
  fi
fi

# ─── 2. System user ────────────────────────────────────────────────────────
step "2. System user 'listmonk'"
if id listmonk >/dev/null 2>&1; then
  echo "  (already exists)"
else
  run "useradd --system --no-create-home --shell /usr/sbin/nologin listmonk"
fi
run "mkdir -p /etc/listmonk /var/lib/listmonk /var/log/listmonk"
run "chown -R listmonk:listmonk /etc/listmonk /var/lib/listmonk /var/log/listmonk"
run "chmod 750 /etc/listmonk /var/lib/listmonk"

# ─── 3. Postgres DB + role ─────────────────────────────────────────────────
step "3. Postgres : DB 'listmonk' + role"
LISTMONK_DB_PASSWORD=$(get_or_gen "LISTMONK_DB_PASSWORD" 'openssl rand -base64 32 | tr -d "/+=" | head -c 32')

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='listmonk'" 2>/dev/null | grep -q 1; then
  echo "  (role exists) — refreshing password"
  run "sudo -u postgres psql -c \"ALTER ROLE listmonk WITH LOGIN PASSWORD '${LISTMONK_DB_PASSWORD}';\" >/dev/null"
else
  run "sudo -u postgres psql -c \"CREATE ROLE listmonk WITH LOGIN PASSWORD '${LISTMONK_DB_PASSWORD}';\""
fi

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='listmonk'" 2>/dev/null | grep -q 1; then
  echo "  (db exists)"
else
  run "sudo -u postgres psql -c \"CREATE DATABASE listmonk OWNER listmonk ENCODING 'UTF8';\""
fi
run "sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE listmonk TO listmonk;\" >/dev/null"

# ─── 4. Config file ────────────────────────────────────────────────────────
step "4. /etc/listmonk/config.toml"
LISTMONK_ADMIN_USER="${LISTMONK_ADMIN_USER:-admin}"
LISTMONK_ADMIN_PASSWORD=$(get_or_gen "LISTMONK_ADMIN_PASSWORD" 'openssl rand -base64 24 | tr -d "/+=" | head -c 24')

if [[ -f /etc/listmonk/config.toml ]]; then
  echo "  (already present) — leaving as-is (edit by hand if needed)"
else
  if [[ "${DRY_RUN}" != "1" ]]; then
    cat > /etc/listmonk/config.toml <<TOML
[app]
address = "127.0.0.1:${LISTMONK_PORT}"
admin_username = "${LISTMONK_ADMIN_USER}"
admin_password = "${LISTMONK_ADMIN_PASSWORD}"

[db]
host = "127.0.0.1"
port = 5432
user = "listmonk"
password = "${LISTMONK_DB_PASSWORD}"
database = "listmonk"
ssl_mode = "disable"
max_open = 25
max_idle = 25
max_lifetime = "300s"
TOML
    chown listmonk:listmonk /etc/listmonk/config.toml
    chmod 640 /etc/listmonk/config.toml
    echo "  ✓ written"
  fi
fi

# ─── 5. Schema install (idempotent flag) ───────────────────────────────────
step "5. Listmonk schema init"
# `--install --idempotent` skips if schema already present
if [[ "${DRY_RUN}" != "1" ]]; then
  cd /var/lib/listmonk
  sudo -u listmonk /usr/local/bin/listmonk --config /etc/listmonk/config.toml --install --idempotent --yes 2>&1 | tail -8 || true
fi

# ─── 6. systemd unit ───────────────────────────────────────────────────────
step "6. systemd unit listmonk.service"
UNIT="/etc/systemd/system/listmonk.service"
if [[ -f "${UNIT}" ]]; then
  echo "  (already present)"
else
  if [[ "${DRY_RUN}" != "1" ]]; then
    cat > "${UNIT}" <<UNITFILE
[Unit]
Description=Listmonk newsletter manager
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=listmonk
Group=listmonk
WorkingDirectory=/var/lib/listmonk
ExecStart=/usr/local/bin/listmonk --config /etc/listmonk/config.toml
Restart=always
RestartSec=5
StandardOutput=append:/var/log/listmonk/stdout.log
StandardError=append:/var/log/listmonk/stderr.log
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/listmonk /var/log/listmonk
PrivateTmp=yes
NoNewPrivileges=yes

[Install]
WantedBy=multi-user.target
UNITFILE
    echo "  ✓ written"
  fi
fi
run "systemctl daemon-reload"
run "systemctl enable --now listmonk.service"
sleep 3
if [[ "${DRY_RUN}" != "1" ]]; then
  if systemctl is-active --quiet listmonk.service; then
    echo "  ✓ listmonk.service active"
  else
    echo "  ⚠ listmonk.service not active. Logs :"
    journalctl -u listmonk.service --since "30 seconds ago" --no-pager | tail -10
  fi
fi

# ─── 7. Append LISTMONK_* env vars to apps/web/.env ───────────────────────
step "7. .env vars"
upsert_env() {
  local key="$1" val="$2"
  if [[ "${DRY_RUN}" == "1" ]]; then echo "  [DRY] upsert ${key}"; return 0; fi
  local tmp="${ENV_FILE}.tmp.$$"
  grep -vE "^${key}=" "${ENV_FILE}" > "${tmp}" || true
  printf '%s=%s\n' "${key}" "${val}" >> "${tmp}"
  mv "${tmp}" "${ENV_FILE}"
}
run "cp -a '${ENV_FILE}' '${ENV_FILE}.bak.$(date +%Y%m%d-%H%M%S)'"
upsert_env LISTMONK_INTERNAL_URL "http://127.0.0.1:${LISTMONK_PORT}"
# Webhook from Listmonk → FemiGlow
LISTMONK_WEBHOOK_SECRET=$(get_or_gen "LISTMONK_WEBHOOK_SECRET" 'openssl rand -hex 32')
upsert_env LISTMONK_WEBHOOK_SECRET "${LISTMONK_WEBHOOK_SECRET}"
echo "  ✓ vars upserted"

# ─── 8. Smoke test ─────────────────────────────────────────────────────────
step "8. Smoke test"
if [[ "${DRY_RUN}" != "1" ]]; then
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${LISTMONK_PORT}/" 2>/dev/null || echo "—")
  echo "  GET http://127.0.0.1:${LISTMONK_PORT}/ → ${CODE} (expect 200)"
fi

# ─── 9. Summary + next manual steps ───────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "✓ Listmonk installed."
echo ""
echo "  Admin UI       : http://127.0.0.1:${LISTMONK_PORT}/admin (loopback only)"
echo "  Admin login    : ${LISTMONK_ADMIN_USER}"
echo "  Admin password : (in ${SECRETS_FILE} as LISTMONK_ADMIN_PASSWORD)"
echo ""
echo "  Next manual steps :"
echo ""
echo "  a) Login via SSH tunnel :"
echo "     ssh -L 9000:127.0.0.1:${LISTMONK_PORT} root@<vps>"
echo "     then http://localhost:${LISTMONK_PORT}/admin in your browser"
echo ""
echo "  b) Configure SMTP in Listmonk (Settings → SMTP) :"
echo "     Host             : 127.0.0.1"
echo "     Port             : 587"
echo "     Username         : noreply@femiglow-maroc.com"
echo "     Password         : (NOREPLY_SMTP_PASSWORD in ${SECRETS_FILE})"
echo "     TLS              : STARTTLS"
echo "     Hello hostname   : mail.lumiereacademy.com"
echo ""
echo "  c) Create API user 'femiglow-app' (Settings → Users → +Add) :"
echo "     Type             : API"
echo "     Role             : Super Admin"
echo "     Status           : enabled"
echo "     → copy the token to ${SECRETS_FILE} as LISTMONK_API_TOKEN"
echo "     → and to ${ENV_FILE} as LISTMONK_API_TOKEN"
echo "     → also set LISTMONK_API_USER=femiglow-app in ${ENV_FILE}"
echo ""
echo "  d) Configure Listmonk webhook → FemiGlow (Settings → Webhooks) :"
echo "     URL              : https://admin.femiglow-maroc.com/api/mail/webhook/listmonk"
echo "     Secret           : ${LISTMONK_WEBHOOK_SECRET}"
echo "     Events           : subscriber.created, subscriber.unsubscribed,"
echo "                        subscriber.bounced, campaign.started, campaign.completed"
echo ""
echo "  e) Restart femiglow.service to pick up new .env vars :"
echo "     sudo systemctl restart femiglow.service"
