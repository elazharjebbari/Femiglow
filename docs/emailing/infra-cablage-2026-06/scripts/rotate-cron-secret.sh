#!/usr/bin/env bash
# rotate-cron-secret.sh — P1b : rotation du CRON_SECRET prod.
#
# Séquence (fenêtre de désynchro ≤ durée du restart, ~2s) :
#   1. nouveau secret 64-hex (jamais affiché)
#   2. .env prod : remplace la ligne CRON_SECRET (backup horodaté 0600 dans /root)
#   3. /etc/femiglow-cron.env : remplace (les unités le lisent au prochain start)
#   4. retire /etc/femiglow-cron-insights.env (unité déjà migrée sur le commun)
#   5. systemctl restart femiglow.service + attente 200
#   6. oracle : ANCIEN secret -> 401 ; NOUVEAU -> 200 (route email-outbox)
#
# Prérequis : migrate-units-envfile.sh déjà passé (T12/T13 verts).
set -euo pipefail

APP_ENV=/var/www/femiglow/apps/web/.env
CRON_ENV=/etc/femiglow-cron.env
URL="http://127.0.0.1:8011/api/cron/email-outbox"
TS="$(date +%Y%m%d-%H%M%S)"

[[ -f "$APP_ENV" && -f "$CRON_ENV" ]] || { echo "fichier env manquant" >&2; exit 2; }
if grep -rqE 'Bearer [0-9a-fA-F]{32,}' /etc/systemd/system/femiglow-cron-*.service; then
  echo "STOP: des unités portent encore un secret littéral — lancer migrate-units-envfile.sh d'abord" >&2
  exit 2
fi

OLD="$(grep '^CRON_SECRET=' "$APP_ENV" | head -1 | cut -d= -f2-)"
[[ -n "$OLD" ]] || { echo "CRON_SECRET introuvable dans $APP_ENV" >&2; exit 2; }
NEW="$(openssl rand -hex 32)"

install -m 600 "$APP_ENV" "/root/femiglow-env-backup-$TS"   # backup .env complet, 0600
sed -i "s|^CRON_SECRET=.*|CRON_SECRET=$NEW|" "$APP_ENV"
printf 'CRON_SECRET=%s\n' "$NEW" > "$CRON_ENV"; chmod 600 "$CRON_ENV"
[[ -f /etc/femiglow-cron-insights.env ]] && rm /etc/femiglow-cron-insights.env && echo "retiré: femiglow-cron-insights.env"

systemctl restart femiglow.service
for _ in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: femiglow-maroc.com' http://127.0.0.1:8011/ --max-time 3 || true)"
  [[ "$code" == "200" ]] && break; sleep 1
done
[[ "$code" == "200" ]] || { echo "ÉCHEC: femiglow.service ne répond pas après restart — restaurer /root/femiglow-env-backup-$TS" >&2; exit 1; }

c_old="$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $OLD" "$URL" --max-time 30)"
c_new="$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $NEW" "$URL" --max-time 30)"
echo "T17 ancien secret -> $c_old (attendu 401)"
echo "T18 nouveau secret -> $c_new (attendu 200)"
[[ "$c_old" == "401" && "$c_new" == "200" ]] || { echo "ÉCHEC rotation — restaurer le backup et investiguer" >&2; exit 1; }
echo "OK — rotation effectuée. Backup .env : /root/femiglow-env-backup-$TS (0600)."
