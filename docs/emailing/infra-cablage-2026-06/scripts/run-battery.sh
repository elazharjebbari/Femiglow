#!/usr/bin/env bash
# run-battery.sh — Batterie INF (02-batterie-tests.md) : T11→T29, T31–T32, T41.
# Lecture seule sauf tirs manuels T16/T25/T26 (= ce que les timers font déjà).
# exit 0 ssi tout PASS (T41 = WARN toléré tant que R-013 non tranchée).
set -uo pipefail

ENV_FILE=/etc/femiglow-cron.env
UNIT_DIR=/etc/systemd/system
BASE=http://127.0.0.1:8011
PASS=0; FAIL=0; WARN=0

ok()   { echo -e "  \033[32mPASS\033[0m $*"; PASS=$((PASS+1)); }
ko()   { echo -e "  \033[31mFAIL\033[0m $*"; FAIL=$((FAIL+1)); }
wa()   { echo -e "  \033[33mWARN\033[0m $*"; WARN=$((WARN+1)); }

SECRET="$(grep '^CRON_SECRET=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)"

echo "== T1x — hygiène secrets =="
[[ "$(stat -c '%a %U' "$ENV_FILE" 2>/dev/null)" == "600 root" && -n "$SECRET" ]] \
  && ok "T11 env file 0600 root + CRON_SECRET présent" || ko "T11 $ENV_FILE"
if grep -rqE 'Bearer [0-9a-fA-F]{32,}' "$UNIT_DIR"/femiglow-cron-*.service 2>/dev/null; then
  ko "T12 secret littéral résiduel dans une unité"; else ok "T12 zéro secret littéral dans les unités"; fi
MISS=0
for u in "$UNIT_DIR"/femiglow-cron-*.service; do
  [[ "$u" == *staging* || "$u" == *@* ]] && continue
  grep -q "EnvironmentFile=$ENV_FILE" "$u" || { MISS=$((MISS+1)); echo "       sans EnvironmentFile commun: $(basename "$u")"; }
done
[[ "$MISS" -eq 0 ]] && ok "T13 toutes les unités prod sur $ENV_FILE" || ko "T13 $MISS unité(s) divergente(s)"
[[ ! -f "$UNIT_DIR/femiglow-cron@.service" ]] && ok "T14 template @ supprimé" || ko "T14 femiglow-cron@.service présent"
[[ ! -f /etc/femiglow-cron-insights.env ]] && ok "T19 insights.env retiré" || wa "T19 /etc/femiglow-cron-insights.env encore là"

echo "== T2x — timers email =="
declare -A WANT_ENABLED=( [femiglow-cron-email-outbox]=enabled [femiglow-cron-email-automation]=enabled
  [femiglow-cron-email-listmonk-cleanup]=enabled [femiglow-cron-email-audience-purge]=enabled
  [femiglow-cron-rituals-email-j45]=disabled )
for t in "${!WANT_ENABLED[@]}"; do
  if [[ -f "$UNIT_DIR/$t.timer" && -f "$UNIT_DIR/$t.service" ]]; then ok "T21 $t unit+timer présents"
  else ko "T21 $t manquant"; continue; fi
  st="$(systemctl is-enabled "$t.timer" 2>/dev/null || true)"
  [[ "$st" == "${WANT_ENABLED[$t]}" ]] && ok "T22 $t is-enabled=$st (conforme)" || ko "T22 $t is-enabled=$st ≠ ${WANT_ENABLED[$t]}"
done
grep -q 'OnUnitActiveSec=60' "$UNIT_DIR/femiglow-cron-email-automation.timer" \
  && ok "T23 automation 60s" || ko "T23 cadence automation"
CLEAN_H="$(grep -oP 'OnCalendar=\*-\*-\* \K[0-9:]+' "$UNIT_DIR/femiglow-cron-email-listmonk-cleanup.timer" 2>/dev/null)"
PURGE_H="$(grep -oP 'OnCalendar=\*-\*-\* \K[0-9:]+' "$UNIT_DIR/femiglow-cron-email-audience-purge.timer" 2>/dev/null)"
[[ -n "$CLEAN_H" && -n "$PURGE_H" && "$CLEAN_H" < "$PURGE_H" ]] \
  && ok "T24 ordre nocturne cleanup($CLEAN_H) < purge($PURGE_H)" || ko "T24 ordre nocturne ($CLEAN_H vs $PURGE_H)"

echo "== T16/T25/T26 — tirs manuels (équivalents aux ticks) =="
for s in femiglow-cron-email-outbox femiglow-cron-email-automation \
         femiglow-cron-email-listmonk-cleanup femiglow-cron-email-audience-purge \
         femiglow-cron-tick femiglow-cron-insights-refresh femiglow-cron-lead-outbox; do
  [[ -f "$UNIT_DIR/$s.service" ]] || continue
  systemctl start "$s.service" >/dev/null 2>&1
  res="$(systemctl show -p Result --value "$s.service")"
  [[ "$res" == "success" ]] && ok "T16/25/26 $s Result=success" || ko "T16/25/26 $s Result=$res"
done

echo "== T27 — auth fermée sur chaque route cron email =="
for r in email-outbox email-automation email-campaign-sync email-listmonk-cleanup email-audience-purge rituals-email-j45; do
  c1="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/cron/$r" --max-time 15)"
  c2="$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Authorization: Bearer 0000000000000000000000000000000000000000000000000000000000000000' "$BASE/api/cron/$r" --max-time 15)"
  [[ "$c1" == "401" && "$c2" == "401" ]] && ok "T27 $r 401/401" || ko "T27 $r sans=$c1 faux=$c2"
done

echo "== T28 — campaign_sync porté par le tick (D1) =="
LAST_TICK="$(journalctl -u femiglow.service --since '10 minutes ago' --no-pager 2>/dev/null | grep 'cron.tick.completed' | tail -1)"
if [[ "$LAST_TICK" == *campaign_sync* && "$LAST_TICK" != *'"error"'* ]]; then
  ok "T28 tick récent avec campaign_sync sans erreur"
else ko "T28 pas de tick récent sain avec campaign_sync"; fi

echo "== T29 — le timer automation vit =="
L1="$(systemctl show -p LastTriggerUSec --value femiglow-cron-email-automation.timer)"
sleep 65
L2="$(systemctl show -p LastTriggerUSec --value femiglow-cron-email-automation.timer)"
[[ -n "$L1" && "$L1" != "$L2" ]] && ok "T29 LastTrigger a évolué ($L1 → $L2)" || ko "T29 timer automation inerte"

echo "== T3x — webhook (sondes sans creds admin) =="
getent hosts femiglow-maroc.com >/dev/null && ok "T32 DNS femiglow-maroc.com résout" || ko "T32 DNS"
c="$(curl -s -o /dev/null -w '%{http_code}' -X POST https://femiglow-maroc.com/api/mail/webhook/stalwart --max-time 10)"
[[ "$c" == "401" ]] && ok "T31 récepteur vivant et fermé (401)" || ko "T31 récepteur → $c (attendu 401)"

echo "== T41 — Listmonk bounce (constat) =="
BV="$(sudo -u postgres psql -d listmonk -Atc "SELECT value FROM settings WHERE key IN ('bounce.enable','bounce.enabled') LIMIT 1" 2>/dev/null || true)"
if [[ "$BV" == "true" ]]; then ok "T41 bounce.enabled=true"
elif [[ -n "$BV" ]]; then wa "T41 bounce.enabled=$BV (R-013 non tranchée — attendu pour l'instant)"
else wa "T41 setting illisible (DB listmonk inaccessible d'ici)"; fi

echo
echo "Bilan : $PASS PASS / $FAIL FAIL / $WARN WARN"
[[ "$FAIL" -eq 0 ]] || exit 1
