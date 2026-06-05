#!/usr/bin/env bash
# configure-stalwart-webhook.sh — P3/T33 : repointer le webhook Stalwart vers la prod.
#
#   --show   : relevé LECTURE SEULE des settings webhook.* (secrets masqués)
#   --apply  : url -> $WEBHOOK_TARGET_URL + reload + RELECTURE de contrôle
#
# La config Stalwart v0.13 vit dans RocksDB -> uniquement pilotable par l'API
# admin (:8080, basic auth). Creds lus dans /root/.femiglow-emailing-secrets.local,
# JAMAIS affichés. Le script consigne l'URL PRÉCÉDENTE (rollback : relancer avec
# WEBHOOK_TARGET_URL=<ancienne>).
#
# Garde-fou : --apply vérifie d'abord que le récepteur cible répond 401 sans token
# (vivant + fermé) — on ne pointe jamais un webhook vers une URL morte.
set -euo pipefail

MODE="${1:---show}"
SECRETS=/root/.femiglow-emailing-secrets.local
API="${STALWART_API:-http://127.0.0.1:8080}"
TARGET="${WEBHOOK_TARGET_URL:-https://femiglow-maroc.com/api/mail/webhook/stalwart}"

[[ -r "$SECRETS" ]] || { echo "secrets illisibles: $SECRETS" >&2; exit 2; }
set -a; # shellcheck disable=SC1090
source "$SECRETS"; set +a
: "${STALWART_ADMIN_USER:?}"; : "${STALWART_ADMIN_PASSWORD:?}"

api() { curl -sf -u "$STALWART_ADMIN_USER:$STALWART_ADMIN_PASSWORD" --max-time 10 "$@"; }

list_settings() {
  api "$API/api/settings/list?prefix=webhook" | python3 -c '
import json,sys,re
d=json.load(sys.stdin)
items=(d.get("data") or {}).get("items") or {}
if isinstance(items,list): items=dict(items)
for k in sorted(items):
    v=items[k]
    if re.search(r"secret|token|key|password|authorization",k+str(v),re.I): v="***"
    print(f"{k} = {v}")
'
}

case "$MODE" in
  --show)
    echo "== settings webhook.* (masqués) =="
    list_settings
    ;;

  --apply)
    echo "== avant =="
    BEFORE="$(list_settings)"; echo "$BEFORE"
    # Garde-fou : récepteur cible vivant et fermé.
    c="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$TARGET" --max-time 10)"
    [[ "$c" == "401" ]] || { echo "STOP: $TARGET répond $c (attendu 401) — récepteur pas prêt" >&2; exit 1; }

    # Clés url à mettre à jour (toutes les instances webhook.<id>.url).
    mapfile -t URL_KEYS < <(echo "$BEFORE" | grep -oP '^webhook\.[^=]*\.url(?= =)' || true)
    (( ${#URL_KEYS[@]} > 0 )) || { echo "STOP: aucun webhook.<id>.url trouvé — créer le webhook via le webadmin d'abord" >&2; exit 1; }
    echo "$BEFORE" | grep -q 'X-FG-Webhook-Token' \
      || echo "ATTENTION: header X-FG-Webhook-Token absent du relevé — l'ajouter via le webadmin (sinon la prod répondra 401)."

    for key in "${URL_KEYS[@]}"; do
      prev="$(echo "$BEFORE" | grep -F "$key = " | sed 's/^[^=]*= //')"
      echo "ROLLBACK NOTE: $key était '$prev'"
      # Forme 1 (webadmin) : tableau d'updates.
      if ! api -X POST "$API/api/settings" \
            -H 'Content-Type: application/json' \
            -d "[{\"assert_empty\":false,\"prefix\":\"${key%url}\",\"values\":[[\"url\",\"$TARGET\"]]}]" >/dev/null 2>&1; then
        # Forme 2 : objet clé->valeur.
        api -X POST "$API/api/settings" -H 'Content-Type: application/json' \
            -d "{\"$key\":\"$TARGET\"}" >/dev/null \
          || { echo "ÉCHEC: l'API settings refuse les deux formes — utiliser le webadmin (Settings → Webhooks)" >&2; exit 1; }
      fi
    done

    api -X GET "$API/api/reload" >/dev/null || api -X POST "$API/api/reload" >/dev/null \
      || echo "WARN: reload non confirmé — redémarrer stalwart-mail.service si la relecture diverge"

    echo "== après (relecture de contrôle) =="
    AFTER="$(list_settings)"; echo "$AFTER"
    if echo "$AFTER" | grep -qF ".url = $TARGET"; then
      echo "OK — webhook repointé vers $TARGET"
    else
      echo "ÉCHEC: la relecture ne montre pas $TARGET — rien n'a peut-être été écrit. Fallback webadmin." >&2
      exit 1
    fi
    echo "Suite : bash $(dirname "$0")/verify-webhook-e2e.sh   (T51–T53)"
    ;;
  *) echo "usage: $0 [--show|--apply]" >&2; exit 2 ;;
esac
