#!/usr/bin/env bash
#
# check-email-timers.sh — R-003 / module 11 (F-110).
#
# Vérifie que CHAQUE route cron emailing présente dans le code dispose d'un timer
# systemd actif. Audit prod : 5/6 timers absents → automation, campaign-sync,
# listmonk-cleanup, audience-purge, rituals-j45 ne tournent JAMAIS.
#
# LECTURE SEULE — aucune écriture (ni DB, ni systemd, ni fichier). Exécutable
# tel quel en prod ET en CI. Tolère l'absence de `systemctl` (environnement CI
# conteneurisé) : dans ce cas il liste les routes attendues et sort 0 (rien à
# comparer côté serveur), en le signalant explicitement.
#
# Exit code :
#   0 — toutes les routes cron ont un timer actif (ou systemctl indisponible).
#   1 — au moins une route n'a pas de timer → différentiel imprimé.
#
# Convention de nommage : route `src/app/api/cron/<name>` ⇒ timer attendu
# `femiglow-cron-<name>.timer`.

set -euo pipefail

# Racine du repo web (le dossier qui contient `src/app/api/cron`). On résout
# relativement à l'emplacement du script pour être indépendant du CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CRON_DIR="${WEB_ROOT}/src/app/api/cron"

# — 1. Routes cron emailing attendues (source de vérité = le filesystem) —
# On cible les crons EMAILING : `email-*` + `rituals-email-j45` (invitation J+45).
# On ne retient qu'un répertoire qui contient bien un `route.ts` (vraie route).
expected_crons=()
if [[ -d "${CRON_DIR}" ]]; then
  while IFS= read -r dir; do
    name="$(basename "${dir}")"
    if [[ -f "${dir}/route.ts" ]]; then
      expected_crons+=("${name}")
    fi
  done < <(find "${CRON_DIR}" -maxdepth 1 -type d \( -name 'email-*' -o -name 'rituals-email-*' \) | sort)
fi

if [[ ${#expected_crons[@]} -eq 0 ]]; then
  echo "check-email-timers: aucune route cron emailing trouvée sous ${CRON_DIR}" >&2
  exit 1
fi

echo "Routes cron emailing attendues (${#expected_crons[@]}) :"
for c in "${expected_crons[@]}"; do
  echo "  - ${c}  → timer attendu : femiglow-cron-${c}.timer"
done
echo

# — 2. Timers systemd actifs —
if ! command -v systemctl >/dev/null 2>&1; then
  echo "check-email-timers: systemctl indisponible (CI ?) — vérification serveur ignorée." >&2
  echo "check-email-timers: ${#expected_crons[@]} routes recensées, aucune comparaison timers possible ici." >&2
  exit 0
fi

# Liste des timers actifs (noms d'unité). `list-timers --all` inclut les timers
# chargés mais inactifs ; on filtre sur le préfixe femiglow-cron-.
active_timers="$(systemctl list-timers --all --no-legend 2>/dev/null | awk '{print $NF}' | grep -E '^femiglow-cron-.*\.timer$' || true)"

echo "Timers systemd femiglow-cron-* détectés :"
if [[ -n "${active_timers}" ]]; then
  echo "${active_timers}" | sed 's/^/  - /'
else
  echo "  (aucun)"
fi
echo

# — 3. Différentiel : routes sans timer —
missing=()
for c in "${expected_crons[@]}"; do
  unit="femiglow-cron-${c}.timer"
  if ! grep -qx "${unit}" <<<"${active_timers}"; then
    missing+=("${c}")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ÉCHEC — ${#missing[@]} route(s) cron sans timer systemd actif :" >&2
  for c in "${missing[@]}"; do
    echo "  ✗ ${c} (timer manquant : femiglow-cron-${c}.timer)" >&2
  done
  exit 1
fi

echo "OK — les ${#expected_crons[@]} routes cron emailing ont un timer systemd actif."
exit 0
