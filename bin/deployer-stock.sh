#!/usr/bin/env bash
# Mise en production de l'écran de stock (migration 0088), lancée depuis le Mac.
#   bash bin/deployer-stock.sh verifier   prépare et montre le plan, ne modifie rien
#   bash bin/deployer-stock.sh go         sauvegarde, migration, build sans coupure
# Sur le serveur le script tourne détaché : une coupure SSH ne l'interrompt pas.
set -euo pipefail
MODE="${1:-verifier}"
BRANCH=fix/stock-visible-admin
HOST="${HOST:-alfenna}"
LOG=/root/deploy-stock.log

ssh -o ConnectTimeout=20 "$HOST" "cat > /root/deploy-stock.sh" <<DISTANT
#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C.UTF-8 LANG=C.UTF-8
cd /var/www/femiglow
log() { echo "[stock \$(date -u +%H:%M:%S)] \$*"; }
if [ -n "\$(git status --short --untracked-files=no)" ]; then
  log "REFUS : fichiers suivis modifiés sur le serveur"; git status --short --untracked-files=no; exit 2
fi
log "avant : \$(git branch --show-current) \$(git log --oneline -1)"
sudo -u postgres psql -d femiglow -XAt -F ' | ' -c "SELECT 'stock', available, reserved FROM product_stock" 2>/dev/null
if [ "$MODE" = verifier ]; then
  git fetch -q origin $BRANCH
  log "commits à déployer :"; git log --oneline HEAD..FETCH_HEAD
  log "fichiers de migration ajoutés :"; git diff --name-only HEAD FETCH_HEAD -- apps/web/drizzle/migrations | grep sql
  log "VERIFICATION TERMINEE : rien n'a été modifié"; exit 0
fi
PREV=\$(git branch --show-current)
git fetch -q origin $BRANCH
git checkout -q -B $BRANCH FETCH_HEAD
log "code : \$(git log --oneline -1)"
DUMP=/var/backups/femiglow/pre-0088-\$(date -u +%Y%m%dT%H%M%SZ).dump
sudo -u postgres pg_dump -Fc femiglow > "\$DUMP"
test -s "\$DUMP"; log "sauvegarde : \$DUMP (\$(du -h "\$DUMP" | cut -f1))"
cd apps/web
node scripts/_migrate-safe.mjs --plan 2>&1 | grep -vE "severity|code:|message:|file:|line:|routine:|^[{}]"
PENDING=\$(node scripts/_migrate-safe.mjs --plan 2>/dev/null | grep -cE '^ +→ ' || true)
if [ "\$PENDING" != 1 ]; then
  log "REFUS : \$PENDING migrations en attente au lieu de 1. Retour sur \$PREV."
  cd ../ ; git checkout -q "\$PREV"; exit 3
fi
node scripts/_migrate-safe.mjs 2>&1 | grep -E "Applying|✓|Error|error" 
log "migration appliquée"
cd ../
bash bin/deploy-prod.sh $BRANCH
sudo -u postgres psql -d femiglow -XAt -F ' | ' -c "SELECT 'stock', available, reserved, sell_when_out FROM product_stock" 2>/dev/null
log "FIN"
DISTANT

ssh "$HOST" "nohup bash /root/deploy-stock.sh > $LOG 2>&1; echo \"code retour : \$?\" >> $LOG" &
RUN=$!
sleep 2
# Suit le journal ; si la connexion coupe, le serveur continue.
ssh "$HOST" "tail -n +1 --pid=\$(pgrep -f /root/deploy-stock.sh | head -1) -f $LOG 2>/dev/null; tail -2 $LOG" || true
wait "$RUN" || true
