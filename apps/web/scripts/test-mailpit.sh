#!/bin/bash
# ============================================================================
# Mailpit — serveur SMTP de capture pour le harnais emailing (phase 0.5)
# ----------------------------------------------------------------------------
# Démarre / arrête / inspecte un container Docker `femiglow-mailpit` qui sert
# de boîte aux lettres jetable pour les tests d'intégration et e2e emailing.
#
#   - SMTP   : 127.0.0.1:1025  (les envois des tests pointent ici)
#   - API/UI : 127.0.0.1:8025  (l'UI web + l'API REST v1 de Mailpit)
#
# Les ports sont bindés sur 127.0.0.1 uniquement (jamais exposés au réseau).
#
# Usage :
#   ./scripts/test-mailpit.sh start    # idempotent : démarre ou réutilise
#   ./scripts/test-mailpit.sh stop     # idempotent : arrête + supprime
#   ./scripts/test-mailpit.sh status   # état + sondage de l'API
#
# Les helpers e2e/_helpers/mailpit.ts et les suites test:emails:* supposent
# que ce container tourne. Le démarrage est idempotent : relancer `start`
# sur un container déjà up est un no-op (exit 0).
# ============================================================================
set -euo pipefail

CONTAINER_NAME="femiglow-mailpit"
IMAGE="axllent/mailpit"
SMTP_BIND="127.0.0.1:1025"
API_BIND="127.0.0.1:8025"
API_BASE="http://127.0.0.1:8025/api/v1"

container_state() {
  # Renvoie l'état du container (running, exited, ...) ou vide s'il n'existe pas.
  docker inspect -f '{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null || true
}

cmd_start() {
  local state
  state=$(container_state)

  if [ "$state" = "running" ]; then
    echo "[mailpit] déjà démarré ($CONTAINER_NAME) — no-op."
    cmd_status
    return 0
  fi

  if [ -n "$state" ]; then
    # Container présent mais arrêté (exited/created) : on le retire pour repartir propre.
    echo "[mailpit] container existant en état '$state' — suppression avant redémarrage."
    docker rm -f "$CONTAINER_NAME" >/dev/null
  fi

  echo "[mailpit] démarrage du container $CONTAINER_NAME ..."
  docker run -d \
    --name "$CONTAINER_NAME" \
    -p "${SMTP_BIND}:1025" \
    -p "${API_BIND}:8025" \
    "$IMAGE" >/dev/null

  # Attente active que l'API réponde (pas de sleep arbitraire).
  echo "[mailpit] attente de l'API sur $API_BASE/messages ..."
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null "$API_BASE/messages" 2>/dev/null; then
      echo "[mailpit] prêt."
      cmd_status
      return 0
    fi
    sleep 0.5
  done

  echo "[mailpit] ERREUR : l'API n'a pas répondu dans le délai imparti." >&2
  docker logs "$CONTAINER_NAME" 2>&1 | tail -20 >&2 || true
  return 1
}

cmd_stop() {
  local state
  state=$(container_state)

  if [ -z "$state" ]; then
    echo "[mailpit] aucun container $CONTAINER_NAME — no-op."
    return 0
  fi

  echo "[mailpit] arrêt + suppression de $CONTAINER_NAME ..."
  docker rm -f "$CONTAINER_NAME" >/dev/null
  echo "[mailpit] arrêté."
}

cmd_status() {
  local state
  state=$(container_state)

  if [ -z "$state" ]; then
    echo "[mailpit] status : absent"
    return 0
  fi

  echo "[mailpit] status : $state"
  echo "[mailpit]   SMTP   -> $SMTP_BIND"
  echo "[mailpit]   API/UI -> $API_BIND"

  if [ "$state" = "running" ]; then
    if curl -fsS -o /dev/null "$API_BASE/messages" 2>/dev/null; then
      local count
      count=$(curl -fsS "$API_BASE/messages" | jq -r '.total // .messages_count // "?"' 2>/dev/null || echo '?')
      echo "[mailpit]   API   -> OK (messages.total=$count)"
    else
      echo "[mailpit]   API   -> KO (le container tourne mais l'API ne répond pas)"
    fi
  fi
}

case "${1:-}" in
  start)  cmd_start ;;
  stop)   cmd_stop ;;
  status) cmd_status ;;
  *)
    echo "Usage : $0 {start|stop|status}" >&2
    exit 64
    ;;
esac
