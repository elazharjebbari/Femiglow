#!/usr/bin/env bash
# install-email-timers.sh — P2 : crée les 4 paires unit/timer email manquantes.
#
#   femiglow-cron-email-automation    60s        enabled --now
#   femiglow-cron-email-listmonk-cleanup  03:10  enabled --now (Persistent)
#   femiglow-cron-email-audience-purge    03:30  enabled --now (Persistent)
#   femiglow-cron-rituals-email-j45       09:00  CRÉÉ MAIS DISABLED (D2 : stub + env absente)
#
# Idempotent (réécrit les fichiers, re-enable). Aucun secret dans les unités :
# EnvironmentFile=/etc/femiglow-cron.env. Cf. timers-manifest-v2.yaml.
set -euo pipefail

ENV_FILE=/etc/femiglow-cron.env
UNIT_DIR=/etc/systemd/system
BASE=http://127.0.0.1:8011

[[ -f "$ENV_FILE" ]] || { echo "ABSENT: $ENV_FILE — P1 d'abord" >&2; exit 2; }

write_service() { # name route description timeout
  cat > "$UNIT_DIR/$1.service" <<EOF
[Unit]
Description=FemiGlow cron: $3
After=femiglow.service
Wants=femiglow.service

[Service]
Type=oneshot
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/curl -sf -X POST -H "Authorization: Bearer \${CRON_SECRET}" $BASE$2
TimeoutStartSec=$4
EOF
}

write_timer_interval() { # name seconds description
  cat > "$UNIT_DIR/$1.timer" <<EOF
[Unit]
Description=FemiGlow cron timer: $3 (every $2 s)

[Timer]
OnBootSec=$2
OnUnitActiveSec=$2
AccuracySec=5

[Install]
WantedBy=timers.target
EOF
}

write_timer_calendar() { # name oncalendar persistent description
  cat > "$UNIT_DIR/$1.timer" <<EOF
[Unit]
Description=FemiGlow cron timer: $4 ($2)

[Timer]
OnCalendar=$2
Persistent=$3
AccuracySec=60

[Install]
WantedBy=timers.target
EOF
}

# 1. Automation — le cœur : runner des runs dus + sweep wait_for_event (R-028 fixé).
write_service femiglow-cron-email-automation /api/cron/email-automation \
  "email automation runner + sweep wait_for_event" 90
write_timer_interval femiglow-cron-email-automation 60 "email automation"

# 2. Cleanup Listmonk 03:10 — AVANT la purge (garde anti-fuite de listes, module 10).
write_service femiglow-cron-email-listmonk-cleanup /api/cron/email-listmonk-cleanup \
  "purge des listes Listmonk éphémères expirées" 300
write_timer_calendar femiglow-cron-email-listmonk-cleanup "*-*-* 03:10:00" true "listmonk cleanup"

# 3. Purge snapshots 03:30 — APRÈS le cleanup.
write_service femiglow-cron-email-audience-purge /api/cron/email-audience-purge \
  "purge des snapshots d'audience expirés (>90j)" 300
write_timer_calendar femiglow-cron-email-audience-purge "*-*-* 03:30:00" true "audience purge"

# 4. J+45 — unité posée, timer NON activé (D2). Persistent=false : pas de rattrapage
#    d'un envoi marketing daté.
write_service femiglow-cron-rituals-email-j45 /api/cron/rituals-email-j45 \
  "invitation J+45 review wall (STUB — activer après implémentation + RITUAL_EMAIL_SECRET)" 300
write_timer_calendar femiglow-cron-rituals-email-j45 "*-*-* 09:00:00" false "rituals J+45"

systemd-analyze verify "$UNIT_DIR"/femiglow-cron-email-automation.{service,timer} \
  "$UNIT_DIR"/femiglow-cron-email-listmonk-cleanup.{service,timer} \
  "$UNIT_DIR"/femiglow-cron-email-audience-purge.{service,timer} \
  "$UNIT_DIR"/femiglow-cron-rituals-email-j45.{service,timer}
systemctl daemon-reload

systemctl enable --now femiglow-cron-email-automation.timer
systemctl enable --now femiglow-cron-email-listmonk-cleanup.timer
systemctl enable --now femiglow-cron-email-audience-purge.timer
systemctl disable --now femiglow-cron-rituals-email-j45.timer 2>/dev/null || true

echo "OK — timers installés :"
systemctl list-timers --all --no-pager | grep -E 'email-automation|listmonk-cleanup|audience-purge|rituals-email-j45' || true
echo "(rituals-email-j45 : volontairement disabled — D2)"
