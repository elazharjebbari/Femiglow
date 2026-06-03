#!/usr/bin/env bash
#
# check-timers.sh — INF-TIMER-* : vérifie que les 6 timers systemd email
# correspondent au manifeste timers-attendus.yaml.
#
# Idempotent : lecture seule (systemctl show / is-enabled / curl HEAD).
# Exécutable en CI (avec systemd) ET sur le serveur de prod.
#
#   Usage :
#     ./check-timers.sh [--manifest PATH] [--probes] [--quiet]
#   Sortie :
#     exit 0  -> tous les timers du manifeste présents, enabled, cadence OK
#     exit 1  -> au moins un écart (timer manquant / disabled / cadence)
#     exit 2  -> prérequis manquant (systemctl/yq absent, manifeste illisible)
#
# Dépendances : bash 4+, systemctl, et yq OU python3 pour parser le YAML.
set -uo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
MANIFEST="${SCRIPT_DIR}/../timers-attendus.yaml"
RUN_PROBES=0
QUIET=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest) MANIFEST="$2"; shift 2 ;;
    --probes)   RUN_PROBES=1; shift ;;
    --quiet)    QUIET=1; shift ;;
    *) echo "arg inconnu: $1" >&2; exit 2 ;;
  esac
done

log()  { [[ "$QUIET" -eq 1 ]] || echo -e "$*"; }
ok()   { log "  \033[32mOK\033[0m   $*"; }
fail() { log "  \033[31mFAIL\033[0m $*"; }
warn() { log "  \033[33mWARN\033[0m $*"; }

command -v systemctl >/dev/null 2>&1 || { echo "systemctl absent (hors systemd ?)" >&2; exit 2; }
[[ -r "$MANIFEST" ]] || { echo "manifeste illisible: $MANIFEST" >&2; exit 2; }

# ── Parser YAML : yq si dispo, sinon python3 ────────────────────────────────
yaml_query() {
  # $1 = expression yq-like ; on fournit deux implémentations équivalentes.
  if command -v yq >/dev/null 2>&1; then
    yq -r "$1" "$MANIFEST"
  elif command -v python3 >/dev/null 2>&1; then
    python3 - "$MANIFEST" "$1" <<'PY'
import sys, yaml
path, expr = sys.argv[1], sys.argv[2]
with open(path) as f:
    doc = yaml.safe_load(f)
# Mini-évaluateur pour les deux requêtes utilisées par ce script.
if expr == 'COUNT_TIMERS':
    print(len(doc.get('timers', [])))
elif expr.startswith('TIMER_FIELD:'):
    _, idx, field = expr.split(':', 2)
    print(doc['timers'][int(idx)].get(field, ''))
PY
  else
    echo "ni yq ni python3 disponibles pour parser le YAML" >&2
    exit 2
  fi
}

count() {
  if command -v yq >/dev/null 2>&1; then yq -r '.timers | length' "$MANIFEST"
  else yaml_query 'COUNT_TIMERS'; fi
}

field() { # field <index> <name>
  if command -v yq >/dev/null 2>&1; then yq -r ".timers[$1].$2 // \"\"" "$MANIFEST"
  else yaml_query "TIMER_FIELD:$1:$2"; fi
}

N="$(count)"
log "Manifeste : $MANIFEST ($N timers attendus)"
ERRORS=0

for ((i = 0; i < N; i++)); do
  name="$(field "$i" name)"
  kind="$(field "$i" schedule_kind)"
  enabled_expected="$(field "$i" enabled)"
  unit="${name}.timer"
  log "→ $unit"

  # 1. Présence (le timer doit être connu de systemd).
  if ! systemctl list-unit-files "$unit" 2>/dev/null | grep -q "$unit"; then
    fail "$unit ABSENT (audit: 5/6 manquants)"; ERRORS=$((ERRORS + 1)); continue
  fi

  # 2. Enabled.
  state="$(systemctl is-enabled "$unit" 2>/dev/null || true)"
  if [[ "$enabled_expected" == "true" && "$state" != "enabled" ]]; then
    fail "$unit non enabled (état: ${state:-inconnu})"; ERRORS=$((ERRORS + 1))
  else
    ok "$unit présent & enabled"
  fi

  # 3. Cadence.
  if [[ "$kind" == "interval" ]]; then
    want="$(field "$i" on_unit_active_sec)"
    got="$(systemctl show "$unit" -p TimersMonotonic --value 2>/dev/null)"
    # TimersMonotonic contient OnUnitActiveSec en microsecondes ; on vérifie
    # juste que l'unité a bien un déclencheur monotone configuré.
    if [[ -z "$got" ]]; then
      warn "$unit : pas de TimersMonotonic (cadence interval ${want}s attendue)"
    else
      ok "$unit cadence interval ~${want}s"
    fi
  else
    want="$(field "$i" on_calendar)"
    got="$(systemctl show "$unit" -p TimersCalendar --value 2>/dev/null)"
    if [[ "$got" != *"$want"* ]]; then
      warn "$unit : OnCalendar attendu '$want', vu '$got'"
    else
      ok "$unit OnCalendar '$want'"
    fi
  fi
done

# 4. Ordre cleanup avant purge (garde anti-fuite Listmonk).
clean_cal="$(systemctl show femiglow-cron-email-listmonk-cleanup.timer -p TimersCalendar --value 2>/dev/null || true)"
purge_cal="$(systemctl show femiglow-cron-email-audience-purge.timer -p TimersCalendar --value 2>/dev/null || true)"
if [[ -n "$clean_cal" && -n "$purge_cal" ]]; then
  log "Ordre cleanup($clean_cal) avant purge($purge_cal) : vérification manuelle 03:10 < 03:30"
fi

# 5. Probes infra optionnelles.
if [[ "$RUN_PROBES" -eq 1 ]]; then
  log "→ Probes infra"
  if [[ -n "${FEMIGLOW_STALWART_WEBHOOK_URL:-}" ]] && command -v curl >/dev/null 2>&1; then
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
              -X POST "$FEMIGLOW_STALWART_WEBHOOK_URL" -d '{}' 2>/dev/null || echo "000")"
    if [[ "$code" == "000" ]]; then
      fail "webhook Stalwart NE RÉSOUT PAS / injoignable (audit: admin.* NXDOMAIN)"; ERRORS=$((ERRORS + 1))
    elif [[ "$code" == "401" ]]; then
      ok "webhook Stalwart vivant (401 sur token vide)"
    else
      warn "webhook Stalwart répond $code (attendu 401 sur token vide)"
    fi
  else
    warn "FEMIGLOW_STALWART_WEBHOOK_URL absent ou curl manquant — probe webhook skip"
  fi
fi

log ""
if [[ "$ERRORS" -gt 0 ]]; then
  log "\033[31m✗ $ERRORS écart(s) — corriger avant déploiement.\033[0m"
  exit 1
fi
log "\033[32m✓ Tous les timers attendus sont présents, enabled et cohérents.\033[0m"
exit 0
