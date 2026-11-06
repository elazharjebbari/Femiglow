#!/usr/bin/env bash
# Mise en production de l'écran de stock (migration 0088), lancée depuis le Mac.
#   bash bin/deployer-stock.sh verifier   prépare et montre le plan, ne modifie rien
#   bash bin/deployer-stock.sh go         sauvegarde, migration, build sans coupure
#   bash bin/deployer-stock.sh reprendre  build seul, si la migration est déjà passée
#   bash bin/deployer-stock.sh installer  envoie .next compilé sur le Mac, le teste sur un port
#                                         à part, puis bascule (le serveur n'a plus la mémoire
#                                         pour compiler). Compiler d'abord : voir compiler-mac.sh
# Sur le serveur le script tourne détaché : une coupure SSH ne l'interrompt pas.
set -euo pipefail
MODE="${1:-verifier}"
BRANCH=fix/stock-visible-admin
HOST="${HOST:-alfenna}"
LOG=/root/deploy-stock.log

if [ "$MODE" = installer ]; then
  HERE="$(cd "$(dirname "$0")" && pwd)"
  DOSSIER="$HERE/../apps/web/.next"
  [ -s "$DOSSIER/BUILD_ID" ] || { echo "Aucune compilation dans $DOSSIER : lancer bin/compiler-mac.sh"; exit 2; }
  echo "envoi de la compilation $(cat "$DOSSIER/BUILD_ID")…"
  rsync -a --delete --exclude cache -e ssh "$DOSSIER/" "$HOST:/var/www/femiglow/apps/web/.next-build/"
fi

ssh -o ConnectTimeout=20 "$HOST" "cat > /root/deploy-stock.sh" <<DISTANT
#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C.UTF-8 LANG=C.UTF-8
cd /var/www/femiglow
log() { echo "[stock \$(date -u +%H:%M:%S)] \$*"; }
# tsconfig.json et settings.local.json sont modifiés de longue date ; un conflit
# réel ferait échouer le checkout, sans rien changer.
log "fichiers suivis modifiés sur le serveur :"; git status --short --untracked-files=no
log "avant : \$(git branch --show-current) \$(git log --oneline -1)"
sudo -u postgres psql -d femiglow -XAt -F ' | ' -c "SELECT 'stock', available, reserved FROM product_stock" 2>/dev/null
if [ "$MODE" = verifier ]; then
  git fetch -q origin $BRANCH
  log "commits à déployer :"; git log --oneline HEAD..FETCH_HEAD
  log "fichiers de migration ajoutés :"; git diff --name-only HEAD FETCH_HEAD -- apps/web/drizzle/migrations | grep sql
  log "VERIFICATION TERMINEE : rien n'a été modifié"; exit 0
fi
if [ "$MODE" = installer ]; then
  cd apps/web
  test -s .next-build/BUILD_ID
  log "version à installer : \$(cat .next-build/BUILD_ID), en ligne : \$(cat .next/BUILD_ID)"
  # Sitemap et robots sont figés à la compilation : on garde ceux de la production,
  # générés avec la base, que le Mac n'a pas.
  cp .next/server/app/sitemap.xml.body .next-build/server/app/sitemap.xml.body
  cp .next/server/app/robots.txt.body .next-build/server/app/robots.txt.body
  chown -R --reference=.next .next-build

  log "essai sur le port 8019, le site en ligne n'est pas touché"
  sudo -u nodeapp env NODE_ENV=production NEXT_DIST_DIR=.next-build PORT=8019 \\
    node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 8019 > /tmp/essai-8019.log 2>&1 &
  # Jamais de pkill par nom : next devient « next-server », comme le site en ligne.
  # Seul le processus à l'écoute sur 8019 est visé.
  arreter() {
    local pid
    pid=\$(ss -Hltnp 'sport = :8019' 2>/dev/null | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2 || true)
    [ -n "\$pid" ] && kill "\$pid" 2>/dev/null || true
  }
  trap arreter EXIT
  for _ in \$(seq 1 40); do
    [ "\$(curl -s -o /dev/null -m 3 -w '%{http_code}' http://127.0.0.1:8019/api/health)" = 200 ] && break
    sleep 1
  done
  OK=1
  essai() { # chemin code-attendu
    code=\$(curl -s -o /dev/null -m 30 -w '%{http_code}' "http://127.0.0.1:8019\$1" || echo 000)
    log "  \$1 → \$code (attendu \$2)"; [ "\$code" = "\$2" ] || OK=0
  }
  essai /api/health 200
  essai /kit 200
  essai /ar/kit 200
  essai / 200
  essai /legal/cgv 200
  essai /fr/legal/cgv 200
  essai /sitemap.xml 200
  essai /admin/login 200
  essai /api/checkout/stock/pvar_ukmyfpxwh7tpp79z 200
  CHUNK=\$(curl -s -m 30 http://127.0.0.1:8019/kit | grep -oE '/_next/static/chunks/[^"]+\\.js' | head -1)
  essai "\$CHUNK" 200
  log "  stock vu par la nouvelle version : \$(curl -s -m 10 http://127.0.0.1:8019/api/checkout/stock/pvar_ukmyfpxwh7tpp79z | cut -c1-110)"
  arreter; trap - EXIT
  if [ "\$OK" != 1 ]; then
    log "ESSAI EN ECHEC : aucune bascule, le site n'a pas changé"; tail -15 /tmp/essai-8019.log; exit 4
  fi
  log "essai réussi : bascule"
  rm -rf .next-prev
  mv .next .next-prev
  mv .next-build .next
  rm -rf .next/cache/fetch-cache
  systemctl restart femiglow
  for _ in \$(seq 1 30); do
    sleep 1
    if [ "\$(curl -s -o /dev/null -m 10 -w '%{http_code}' http://127.0.0.1:8011/kit)" = 200 ] \\
      && [ "\$(curl -s -o /dev/null -m 10 -w '%{http_code}' http://127.0.0.1:8011/ar/kit)" = 200 ]; then
      log "OK : \$(cat .next/BUILD_ID) en ligne, précédent gardé dans .next-prev"
      sudo -u postgres psql -d femiglow -XAt -F ' | ' -c "SELECT 'stock', available, reserved, sell_when_out FROM product_stock" 2>/dev/null
      log "FIN"; exit 0
    fi
  done
  log "ECHEC après bascule : retour à la version précédente"
  rm -rf .next-failed; mv .next .next-failed; mv .next-prev .next
  systemctl restart femiglow; sleep 5
  log "retour : /kit → \$(curl -s -o /dev/null -m 10 -w '%{http_code}' http://127.0.0.1:8011/kit)"
  exit 5
fi
if [ "$MODE" = reprendre ]; then
  # Migration déjà appliquée : seule reste la compilation.
  # Serveur plein (swap saturé, 2,7 Go libres) : le build a été tué le 06/11.
  # On libère ce qui n'a pas de trafic, le temps du build, et tout repart à la fin
  # même en cas d'échec. Le processus le plus gros reste le build : en cas de
  # manque, c'est lui que le noyau tue, le site en ligne continue.
  STAGING=\$(docker ps --filter name=tiwizi-staging --format '{{.Names}}' | tr '\\n' ' ')
  relancer() {
    log "relance de Nuri et de la préprod Tiwizi"
    systemctl start nuri nuri-cron-watchdog.timer || true
    [ -n "\$STAGING" ] && docker start \$STAGING > /dev/null || true
  }
  trap relancer EXIT
  systemctl stop nuri-cron-watchdog.timer nuri
  [ -n "\$STAGING" ] && docker stop \$STAGING > /dev/null
  log "mémoire disponible : \$(free -m | awk 'NR==2{print \$7}') Mo"
  NEXT_BUILD_CPUS=1 BUILD_HEAP_MB=2800 bash bin/deploy-prod.sh $BRANCH
  sudo -u postgres psql -d femiglow -XAt -F ' | ' -c "SELECT 'stock', available, reserved, sell_when_out FROM product_stock" 2>/dev/null
  log "FIN"; exit 0
fi
PREV=\$(git branch --show-current)
git fetch -q origin $BRANCH
git checkout -q -B $BRANCH FETCH_HEAD
log "code : \$(git log --oneline -1)"
DUMP=/var/backups/femiglow/pre-0088-\$(date -u +%Y%m%dT%H%M%SZ).dump
sudo -u postgres pg_dump -Fc femiglow > "\$DUMP"
test -s "\$DUMP"; log "sauvegarde : \$DUMP (\$(du -h "\$DUMP" | cut -f1))"
cd apps/web
node --env-file=.env scripts/_migrate-safe.mjs --plan 2>&1 | grep -vE "severity|code:|message:|file:|line:|routine:|^[{}]"
PENDING=\$(node --env-file=.env scripts/_migrate-safe.mjs --plan 2>/dev/null | grep -cE '^ +→ ' || true)
if [ "\$PENDING" != 1 ]; then
  log "REFUS : \$PENDING migrations en attente au lieu de 1. Retour sur \$PREV."
  cd ../.. ; git checkout -q "\$PREV"; exit 3
fi
node --env-file=.env scripts/_migrate-safe.mjs 2>&1 | grep -E "Applying|✓|Error|error"
log "migration appliquée"
cd ../..
bash bin/deploy-prod.sh $BRANCH
sudo -u postgres psql -d femiglow -XAt -F ' | ' -c "SELECT 'stock', available, reserved, sell_when_out FROM product_stock" 2>/dev/null
log "FIN"
DISTANT

ssh "$HOST" "(nohup bash -c 'bash /root/deploy-stock.sh; echo code retour : \$?' > $LOG 2>&1 &) < /dev/null"

# Suit le journal. Une coupure SSH n'arrête rien : la boucle reprend au prochain essai.
n=1
while :; do
  sleep 5
  out="$(ssh -o ConnectTimeout=20 "$HOST" "tail -n +$n $LOG" 2>/dev/null || true)"
  [ -z "$out" ] && continue
  printf '%s\n' "$out"
  n=$((n + $(printf '%s\n' "$out" | wc -l)))
  printf '%s\n' "$out" | grep -q '^code retour : ' && break
done
