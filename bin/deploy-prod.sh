#!/usr/bin/env bash
# Déploiement prod SANS COUPURE de femiglow-maroc.com (à lancer sur le serveur).
#
#   sudo bash /var/www/femiglow/bin/deploy-prod.sh [branche]   (défaut : feat/kit-coherence)
#
# 1. fast-forward de la branche ;
# 2. build dans `.next-build` (NEXT_DIST_DIR) pendant que le serveur continue
#    de servir `.next` — avant, `pnpm build` réécrivait `.next` en place et le
#    site cassait pendant toute la durée du build ;
# 3. échange atomique des dossiers (`.next` → `.next-prev`, `.next-build` → `.next`),
#    purge du fetch-cache, redémarrage (quelques secondes) ;
# 4. contrôle de santé ; en cas d'échec, retour automatique à `.next-prev`.
#
# Ne lance ni migration ni `pnpm install` : à faire avant si besoin.
set -euo pipefail

BRANCH="${1:-feat/kit-coherence}"
APP=/var/www/femiglow
WEB="$APP/apps/web"
SERVICE=femiglow.service
HEALTH_URLS=("http://127.0.0.1:8011/kit" "http://127.0.0.1:8011/ar/kit" "http://127.0.0.1:8011/")

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

healthy() {
  local url code
  for url in "${HEALTH_URLS[@]}"; do
    code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$url" || true)
    [ "$code" = "200" ] || { log "santé KO : $url → $code"; return 1; }
  done
}

cd "$APP"
git fetch -q origin "$BRANCH"
git merge --ff-only "origin/$BRANCH"
log "code : $(git log --oneline -1)"

cd "$WEB"
rm -rf .next-build
mkdir -p .next-build/cache
# Réutilise le cache webpack (builds plus rapides) ; jamais le fetch-cache.
if [ -d .next/cache/webpack ]; then cp -a .next/cache/webpack .next-build/cache/; fi
free -m | awk '/^Mem:/ {printf "[deploy] RAM disponible : %s Mo\n", $7}'

log "build dans .next-build (le site reste servi)…"
# Serveur partagé (≈ 3 Go libres) : 2 workers et un tas plafonné, sinon l'OOM
# killer tue le build (code 137). Le site en ligne n'est pas touché tant que
# le build n'a pas réussi.
NEXT_DIST_DIR=.next-build NEXT_BUILD_CPUS="${NEXT_BUILD_CPUS:-2}" \
  NODE_OPTIONS="--max-old-space-size=${BUILD_HEAP_MB:-3072}" nice -n 10 pnpm build
test -s .next-build/BUILD_ID || { log "build incomplet : pas de BUILD_ID"; exit 1; }
chown -R --reference=.next .next-build 2>/dev/null || true

log "bascule"
rm -rf .next-prev
mv .next .next-prev
mv .next-build .next
rm -rf .next/cache/fetch-cache
systemctl restart "$SERVICE"

for _ in $(seq 1 30); do
  sleep 1
  if healthy 2>/dev/null; then
    log "OK — build $(cat .next/BUILD_ID) en ligne (précédent gardé dans .next-prev)"
    exit 0
  fi
done

log "ÉCHEC du contrôle de santé → retour à la version précédente"
rm -rf .next-failed
mv .next .next-failed
mv .next-prev .next
systemctl restart "$SERVICE"
sleep 5
healthy && log "version précédente rétablie" || log "ATTENTION : version précédente KO aussi"
exit 1
