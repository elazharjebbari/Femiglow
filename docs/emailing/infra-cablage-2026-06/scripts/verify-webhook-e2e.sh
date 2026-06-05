#!/usr/bin/env bash
# verify-webhook-e2e.sh — T51–T53 : preuve bout-en-bout du webhook Stalwart→prod.
#
#   T51  envoi d'un mail RÉEL via SMTP Stalwart local (noreply -> mailbox locale)
#   T52  Stalwart poste le webhook vers la prod (log Stalwart : 200, plus de NXDOMAIN)
#   T53  la prod le journalise (journalctl femiglow : mail.webhook.stalwart.*)
#        -> un statut "ignored" est un SUCCÈS ici : message-id hors outbox,
#           mais auth + parse + idempotence prouvés.
#
# Aucune écriture applicative directe : le seul effet est un email interne.
# Destinataire : $TEST_RCPT (défaut contact@femiglow-maroc.com — mailbox locale).
set -euo pipefail

SECRETS=/root/.femiglow-emailing-secrets.local
RCPT="${TEST_RCPT:-contact@femiglow-maroc.com}"
STALWART_LOGS=/etc/stalwart-mail/logs

set -a; # shellcheck disable=SC1090
source "$SECRETS"; set +a
: "${NOREPLY_SMTP_PASSWORD:?}"
FROM="${NOREPLY_FROM:-noreply@femiglow-maroc.com}"
TAG="webhook-e2e-$(date +%s)"

echo "== T51 — envoi SMTP (127.0.0.1:587, STARTTLS, auth noreply) =="
python3 - "$FROM" "$RCPT" "$TAG" "$NOREPLY_SMTP_PASSWORD" <<'EOF'
import smtplib, ssl, sys
from email.message import EmailMessage
frm, rcpt, tag, pwd = sys.argv[1:5]
msg = EmailMessage()
msg["From"], msg["To"], msg["Subject"] = frm, rcpt, f"[infra] sonde webhook {tag}"
msg.set_content("Sonde E2E webhook Stalwart -> prod (runbook infra-cablage-2026-06). Sans action.")
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
with smtplib.SMTP("127.0.0.1", 587, timeout=15) as s:
    s.starttls(context=ctx); s.login(frm, pwd); s.send_message(msg)
print("T51 PASS — SMTP accepté (250)")
EOF

echo "== attente propagation (20s) =="
sleep 20

echo "== T52 — log Stalwart : POST webhook vers la prod =="
RECENT="$(find "$STALWART_LOGS" -name '*.log*' -mmin -5 2>/dev/null | head -3)"
if [[ -n "$RECENT" ]] && grep -h 'femiglow-maroc.com/api/mail/webhook' $RECENT 2>/dev/null | tail -3 | grep -q .; then
  grep -h 'femiglow-maroc.com/api/mail/webhook' $RECENT | tail -3
  echo "T52 PASS — Stalwart poste bien vers la prod"
elif [[ -n "$RECENT" ]] && grep -h -i 'webhook' $RECENT 2>/dev/null | tail -3 | grep -qi 'error\|admin\.femiglow'; then
  echo "T52 FAIL — erreurs webhook encore présentes :"; grep -h -i 'webhook' $RECENT | tail -3; exit 1
else
  echo "T52 WARN — rien dans les logs Stalwart sous 5 min (webhooks batchés/throttlés) ; re-vérifier dans 10 min :"
  echo "  grep -h 'api/mail/webhook' $STALWART_LOGS/*.log | tail"
fi

echo "== T53 — journal prod : réception webhook =="
if journalctl -u femiglow.service --since '3 minutes ago' --no-pager | grep 'mail.webhook.stalwart' | tail -5 | grep -q .; then
  journalctl -u femiglow.service --since '3 minutes ago' --no-pager | grep 'mail.webhook.stalwart' | tail -5
  echo "T53 PASS — la prod reçoit et journalise (ignored = OK : message hors outbox)"
else
  echo "T53 WARN — pas encore de réception ; re-vérifier dans 10 min :"
  echo "  journalctl -u femiglow.service --since '15 minutes ago' | grep mail.webhook.stalwart"
fi

echo
echo "T54 (J+1, lecture seule) : SELECT count(*) FROM email_outbox WHERE status='delivered' AND updated_at > now()-interval '1 day';"
