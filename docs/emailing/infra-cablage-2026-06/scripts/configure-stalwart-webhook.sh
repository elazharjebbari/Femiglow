#!/usr/bin/env bash
# configure-stalwart-webhook.sh — P3/T33 : repointer le webhook Stalwart vers la prod.
#
#   --show   : relevé LECTURE SEULE des objets webhook (secrets masqués)
#   --apply  : url -> $WEBHOOK_TARGET_URL + relecture de contrôle
#
# Stalwart 0.16.x : la config vit dans RocksDB et se pilote par l'API OBJET
# (stalwart-cli get/query/update — l'ancienne API /api/settings n'existe plus,
# elle répond 404). Creds lus dans /root/.femiglow-emailing-secrets.local via
# les variables d'env STALWART_USER/STALWART_PASSWORD, JAMAIS affichés.
# Le script consigne l'URL PRÉCÉDENTE (rollback : relancer avec
# WEBHOOK_TARGET_URL=<ancienne>).
#
# Garde-fou : --apply vérifie d'abord que le récepteur cible répond 401 sans token
# (vivant + fermé) — on ne pointe jamais un webhook vers une URL morte.
set -euo pipefail

MODE="${1:---show}"
SECRETS=/root/.femiglow-emailing-secrets.local
CLI=/usr/local/bin/stalwart-cli
TARGET="${WEBHOOK_TARGET_URL:-https://femiglow-maroc.com/api/mail/webhook/stalwart}"

[[ -r "$SECRETS" ]] || { echo "secrets illisibles: $SECRETS" >&2; exit 2; }
[[ -x "$CLI" ]] || { echo "stalwart-cli introuvable: $CLI" >&2; exit 2; }
set -a; # shellcheck disable=SC1090
source "$SECRETS"; set +a
: "${STALWART_ADMIN_USER:?}"; : "${STALWART_ADMIN_PASSWORD:?}"
export STALWART_URL="${STALWART_API:-http://127.0.0.1:8080}"
export STALWART_USER="$STALWART_ADMIN_USER"
export STALWART_PASSWORD="$STALWART_ADMIN_PASSWORD"

cli() { "$CLI" --no-color "$@"; }

# Masque toute valeur dont la clé sent le secret, et tout token hex/b64 long.
mask() {
  python3 -c '
import re,sys
for line in sys.stdin:
    if re.search(r"secret|token|password|api[-_]?key|authorization", line, re.I):
        line = re.sub(r"([:=]\s*)\S.*$", r"\1***", line.rstrip()) + "\n"
    line = re.sub(r"\b[0-9a-fA-F]{32,}\b", "***", line)
    sys.stdout.write(line)
'
}

# Types candidats : tout ce qui ressemble à un webhook d'ÉVÉNEMENTS (pas MtaHook,
# qui est du filtrage SMTP). On préfère un type contenant "webhook"/"event".
webhook_types() {
  cli describe 2>/dev/null | grep -oiE '\b[A-Za-z-]*(hook|webhook)[A-Za-z-]*\b' | sort -u
}
webhook_type() {
  local all; all="$(webhook_types)"
  echo "$all" | grep -iE 'webhook|event' | head -1 || echo "$all" | head -1
}

show_webhooks() {
  local t="$1"
  cli query "$t" 2>&1 | mask
}

case "$MODE" in
  --show)
    echo "== schéma : types candidats (hook/webhook/event) =="
    CANDIDATES="$( { webhook_types; cli describe 2>/dev/null | grep -oiE '\b[A-Za-z-]*event[A-Za-z-]*\b'; } | sort -u )"
    if [[ -z "$CANDIDATES" ]]; then
      echo "(aucun type candidat — dump describe pour diagnostic :)"
      cli describe 2>&1 | head -100
      exit 1
    fi
    echo "$CANDIDATES"
    T="$(webhook_type)"
    echo "== type retenu : $T — champs =="
    cli describe "$T" 2>&1 | mask
    echo "== objets $T existants (masqués) =="
    show_webhooks "$T"
    echo "== détail de chaque objet (masqué) =="
    while read -r id; do
      [[ -n "$id" ]] || continue
      echo "-- $T/$id --"
      cli get "$T" "$id" 2>&1 | mask
    done < <(show_webhooks "$T" | awk 'NR>1 {print $1}')
    ;;

  --apply)
    T="$(webhook_type)"; [[ -n "$T" ]] || { echo "STOP: type webhook introuvable dans le schéma" >&2; exit 1; }
    echo "== avant ($T, masqué) =="
    BEFORE="$(show_webhooks "$T")"; echo "$BEFORE"

    # Garde-fou : récepteur cible vivant et fermé.
    c="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$TARGET" --max-time 10)"
    [[ "$c" == "401" ]] || { echo "STOP: $TARGET répond $c (attendu 401) — récepteur pas prêt" >&2; exit 1; }
    echo "garde-fou récepteur : POST sans token -> 401 OK"

    # IDs depuis le tableau de query (col 1, en-tête sauté).
    mapfile -t IDS < <(echo "$BEFORE" | awk 'NR>1 && $1 != "" {print $1}')
    (( ${#IDS[@]} > 0 )) || { echo "STOP: aucun webhook existant — le créer d'abord (webadmin)" >&2; exit 1; }

    prev_url="$(echo "$BEFORE" | grep -oE 'https?://[^" ]+' | head -1 || true)"
    [[ -n "$prev_url" ]] && echo "ROLLBACK NOTE: url précédente = '$prev_url'"

    for id in "${IDS[@]}"; do
      # Présence du header d'auth prod (nom seulement, valeur jamais affichée).
      if cli get "$T" "$id" 2>/dev/null | grep -q 'X-FG-Webhook-Token'; then
        echo "header X-FG-Webhook-Token : présent sur $T/$id"
      else
        echo "ATTENTION: header X-FG-Webhook-Token ABSENT de $T/$id — la prod répondra 401. L'ajouter via webadmin." >&2
      fi
      echo "update $T/$id : url -> $TARGET"
      cli update "$T" "$id" --field "url=$TARGET" \
        || { echo "ÉCHEC update $T/$id — vérifier : stalwart-cli describe $T" >&2; exit 1; }
    done

    echo "== après (relecture de contrôle, masqué) =="
    AFTER="$(show_webhooks "$T")"; echo "$AFTER"
    if echo "$AFTER" | grep -qF "$TARGET"; then
      echo "OK — webhook repointé vers $TARGET"
    else
      echo "ÉCHEC: la relecture ne montre pas $TARGET — rien n'a peut-être été écrit." >&2
      exit 1
    fi
    echo "Suite : bash $(dirname "$0")/verify-webhook-e2e.sh   (T51–T53)"
    ;;
  --check-token)
    # Compare PAR EMPREINTE le header X-FG-Webhook-Token configuré côté Stalwart
    # avec FEMIGLOW_STALWART_WEBHOOK_SECRET du .env prod. Rien n'est affiché en clair.
    T="$(webhook_type)"
    ENV_FILE="${ENV_FILE:-/var/www/femiglow/apps/web/.env}"
    APP_HASH="$(grep '^FEMIGLOW_STALWART_WEBHOOK_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r\n' | sha256sum | cut -c1-12)"
    while read -r id; do
      [[ -n "$id" ]] || continue
      SW_HASH="$(cli get "$T" "$id" --json 2>/dev/null | python3 -c '
import json,sys,hashlib
d=json.load(sys.stdin)
def find(o):
    if isinstance(o,dict):
        for k,v in o.items():
            if k.lower()=="httpheaders" and isinstance(v,dict):
                for hk,hv in v.items():
                    if hk.lower()=="x-fg-webhook-token": return hv
            r=find(v)
            if r is not None: return r
    elif isinstance(o,list):
        for v in o:
            r=find(v)
            if r is not None: return r
    return None
v=find(d)
print(hashlib.sha256(v.encode()).hexdigest()[:12] if v is not None else "ABSENT")
')"
      if [[ "$SW_HASH" == "ABSENT" ]]; then
        echo "$T/$id : header X-FG-Webhook-Token ABSENT côté Stalwart"
      elif [[ "$SW_HASH" == "$APP_HASH" ]]; then
        echo "$T/$id : token MATCH (sha256 identiques) — la prod acceptera les POSTs"
      else
        echo "$T/$id : token MISMATCH (sha256 $SW_HASH ≠ app $APP_HASH) — la prod répond 401 silencieux"
      fi
    done < <(show_webhooks "$T" | awk 'NR>1 && $1 != "" {print $1}')
    ;;
  --schema)
    # Liste complète des types d'objets du schéma (métadonnées, aucun secret).
    cli describe 2>&1
    ;;
  --dump)
    # Snapshot JSON masqué du/des WebHook (diagnostic : noms de champs exacts).
    T="$(webhook_type)"
    while read -r id; do
      [[ -n "$id" ]] || continue
      echo "-- $T/$id (json masqué) --"
      cli get "$T" "$id" --json 2>&1 | mask
    done < <(show_webhooks "$T" | awk 'NR>1 && $1 != "" {print $1}')
    ;;
  --reload)
    # Reload à chaud des settings (équivalent webadmin "Reload settings").
    cli create Action/ReloadSettings --json '{}' && echo "OK — ReloadSettings déclenché"
    ;;

  --recreate)
    # Recrée l'objet WebHook à neuf (cas : collecteur mort malgré config valide —
    # l'update in-place peut laisser des clés legacy en conflit au boot).
    # 1) snapshot AVEC secrets -> /root (0600, jamais affiché, restaurable via `apply`)
    # 2) delete + create avec la même config (url = $TARGET) + ReloadSettings
    T="$(webhook_type)"
    SNAP="/root/femiglow-stalwart-webhook-snapshot-$(date +%Y%m%d-%H%M%S).json"
    umask 077
    cli snapshot WebHook --include-secrets --output "$SNAP"
    chmod 600 "$SNAP"
    echo "snapshot (restaurable: stalwart-cli apply --file): $SNAP"

    mapfile -t IDS < <(show_webhooks "$T" | awk 'NR>1 && $1 != "" {print $1}')
    (( ${#IDS[@]} > 0 )) || { echo "STOP: aucun WebHook à recréer" >&2; exit 1; }

    # Payload de création = objet du snapshot, url remplacée, id retirée.
    python3 - "$SNAP" "$TARGET" > /tmp/webhook-recreate.json <<'PYEOF'
import json,sys
snap=json.load(open(sys.argv[1])); target=sys.argv[2]
# le plan snapshot contient creates/updates : retrouver l'objet WebHook
def find_objs(o):
    if isinstance(o,dict):
        if 'url' in o and 'httpHeaders' in o: yield o
        for v in o.values(): yield from find_objs(v)
    elif isinstance(o,list):
        for v in o: yield from find_objs(v)
objs=list(find_objs(snap))
assert objs, "objet WebHook introuvable dans le snapshot"
obj=dict(objs[0]); obj.pop('id',None); obj['url']=target
json.dump(obj,open('/dev/stdout','w'))
PYEOF
    chmod 600 /tmp/webhook-recreate.json

    for id in "${IDS[@]}"; do cli delete WebHook "$id" && echo "deleted WebHook/$id"; done
    cli create WebHook --file /tmp/webhook-recreate.json && echo "created WebHook (url=$TARGET)"
    rm -f /tmp/webhook-recreate.json
    cli create Action/ReloadSettings --json '{}' >/dev/null && echo "ReloadSettings déclenché"
    echo "== relecture =="
    show_webhooks "$T"
    ;;

  --filter-events)
    # Restreint le webhook aux 6 événements que le récepteur traite (route.ts) :
    # moins de bruit (~95 % du volume = eval.*/store.*/smtp.raw-*) et surtout plus
    # de transit des smtp.raw-input/output (données protocole sensibles) vers l'app.
    # ROLLBACK : cli update WebHook <id> --field eventsPolicy=exclude --field 'events=[]'
    T="$(webhook_type)"
    EVENTS='["queue.message-queued","queue.authenticated-message-queued","queue.rescheduled","delivery.delivered","delivery.failed","auth.failed"]'
    EVENTS_MAP='{"queue.message-queued":true,"queue.authenticated-message-queued":true,"queue.rescheduled":true,"delivery.delivered":true,"delivery.failed":true,"auth.failed":true}'
    while read -r id; do
      [[ -n "$id" ]] || continue
      # Trois formes possibles pour un set<enum> selon la sérialisation de l'API.
      if cli update "$T" "$id" --field eventsPolicy=include --field "events=$EVENTS" 2>/dev/null; then
        echo "OK (forme tableau)"
      elif cli update "$T" "$id" --field eventsPolicy=include --field "events=$EVENTS_MAP" 2>/dev/null; then
        echo "OK (forme map)"
      elif cli update "$T" "$id" --json "{\"eventsPolicy\":\"include\",\"events\":$EVENTS}"; then
        echo "OK (forme json patch)"
      else
        echo "ÉCHEC des trois formes — inspecter avec: stalwart-cli get $T $id --json" >&2; exit 1
      fi
      cli get "$T" "$id" 2>&1 | mask | sed -n '/Event filtering/,$p'
    done < <(show_webhooks "$T" | awk 'NR>1 && $1 != "" {print $1}')
    ;;

  --query)
    # Diagnostic générique : liste les objets d'un type (masqué). Usage : --query <Type> [id]
    TYPE="${2:?usage: --query <Type> [id]}"
    if [[ -n "${3:-}" ]]; then
      cli get "$TYPE" "$3" 2>&1 | mask
    else
      cli query "$TYPE" 2>&1 | mask || true
      echo '--- describe ---'
      cli describe "$TYPE" 2>&1 | mask
    fi
    ;;
  *) echo "usage: $0 [--show|--apply|--check-token|--schema|--dump|--query <Type> [id]]" >&2; exit 2 ;;
esac
