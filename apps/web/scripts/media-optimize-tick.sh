#!/usr/bin/env bash
#
# media-optimize-tick.sh — filet de sécurité du worker d'optimisation média.
#
# Draine la file media_jobs en appelant l'endpoint interne authentifié
# POST /api/cron/media-optimize. L'optimisation se fait normalement en ligne
# à l'upload ; ce tick rattrape les jobs orphelins si un upload échoue à
# mi-chemin ou si le process web est redémarré pendant un traitement.
#
# Le secret est lu depuis apps/web/.env au moment de l'exécution : il ne vit
# jamais dans le crontab ni dans les logs. Seul l'en-tête Authorization le
# transporte (curl ne l'écho pas).
#
# Appelé par crontab toutes les 10 min, sous flock pour éviter tout
# chevauchement (l'endpoint peut tourner jusqu'à ~50 s).
set -euo pipefail

APP_DIR="/var/www/femiglow-staging/apps/web"
ENV_FILE="${APP_DIR}/.env"
URL="http://127.0.0.1:8012/api/cron/media-optimize"

ts() { date -Is; }

if [ ! -r "${ENV_FILE}" ]; then
  echo "$(ts) ERROR .env illisible: ${ENV_FILE}" >&2
  exit 1
fi

SECRET="$(grep -E '^CRON_SECRET=' "${ENV_FILE}" | head -1 | cut -d= -f2-)"
if [ -z "${SECRET}" ]; then
  echo "$(ts) ERROR CRON_SECRET absent de ${ENV_FILE}" >&2
  exit 1
fi

# -f : échoue sur HTTP >= 400 ; -s : silencieux ; -S : montre l'erreur ;
# -m 60 : timeout aligné sur maxDuration de l'endpoint.
RESP="$(curl -fsS -m 60 -X POST -H "Authorization: Bearer ${SECRET}" "${URL}")"
echo "$(ts) ok ${RESP}"
