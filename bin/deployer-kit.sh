#!/usr/bin/env bash
# Mise en production des correctifs du tunnel /kit et de « Ma ville », depuis le Mac.
# Runbook : docs/kit-ma-ville/mise-en-prod.md
#
#   bash bin/deployer-kit.sh verifier    état du serveur, rien n'est modifié
#   bash bin/deployer-kit.sh preparer    sauvegarde base + .env, secret du devis, source alignée
#   bash bin/deployer-kit.sh installer   envoie le .next compilé sur le Mac (bin/compiler-mac.sh),
#                                        l'essaie sur le port 8019, puis bascule ; retour
#                                        automatique à l'ancienne version en cas d'échec
#
# Aucune migration dans cette version. Le serveur ne compile pas (mémoire) : la
# compilation se fait sur le Mac. Sur le serveur, le script tourne détaché : une
# coupure SSH ne l'interrompt pas.
set -euo pipefail
MODE="${1:-verifier}"
BRANCH=fix/kit-bugs-graves
HOST="${HOST:-alfenna}"
LOG=/root/deploy-kit.log

case "$MODE" in verifier|preparer|installer) ;; *) echo "mode inconnu : $MODE"; exit 1 ;; esac

if [ "$MODE" = installer ]; then
  HERE="$(cd "$(dirname "$0")" && pwd)"
  DOSSIER="$HERE/../apps/web/.next"
  [ -s "$DOSSIER/BUILD_ID" ] || { echo "Aucune compilation dans $DOSSIER : lancer bin/compiler-mac.sh"; exit 2; }
  # Une compilation faite avec la config locale embarquerait la base de test.
  if grep -rqsl "55432\|femiglow_test" "$DOSSIER/server" "$DOSSIER/static"; then
    echo "REFUS : la compilation contient l'adresse de la base de test. Recompiler sans .env.production.local."
    exit 2
  fi
  grep -rqsl 'delivery-estimate' "$DOSSIER/static" || { echo "REFUS : compilation sans « Ma ville »."; exit 2; }
  echo "envoi de la compilation $(cat "$DOSSIER/BUILD_ID")…"
  rsync -a --delete --exclude cache -e ssh "$DOSSIER/" "$HOST:/var/www/femiglow/apps/web/.next-build/"
fi

ssh -o ConnectTimeout=20 "$HOST" "cat > /root/deploy-kit.sh" <<DISTANT
#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C.UTF-8 LANG=C.UTF-8
cd /var/www/femiglow
log() { echo "[kit \$(date -u +%H:%M:%S)] \$*"; }
secret_ok() { grep -qE '^PRICE_QUOTE_SECRET=.{32,}' apps/web/.env; }

log "source : \$(git branch --show-current) \$(git log --oneline -1)"
log "build en ligne : \$(cat apps/web/.next/BUILD_ID 2>/dev/null || echo ?)"
log "disque libre : \$(df -h / | awk 'NR==2{print \$4}')"
log "PRICE_QUOTE_SECRET : \$(secret_ok && echo présent || echo ABSENT)"
sudo -u postgres psql -d femiglow -XAt -F ' | ' -c "SELECT 'stock', available, reserved, sell_when_out FROM product_stock" 2>/dev/null

if [ "$MODE" = verifier ]; then
  git fetch -q origin $BRANCH
  log "commits à déployer :"; git log --oneline HEAD..FETCH_HEAD
  log "migrations ajoutées (attendu : aucune) :"
  git diff --name-only HEAD FETCH_HEAD -- apps/web/drizzle/migrations | grep sql || echo "  aucune"
  log "dépendances modifiées (attendu : aucune) :"
  git diff --name-only HEAD FETCH_HEAD -- pnpm-lock.yaml apps/web/package.json || true
  log "VERIFICATION TERMINEE : rien n'a été modifié"; exit 0
fi

if [ "$MODE" = preparer ]; then
  STAMP=\$(date -u +%Y%m%dT%H%M%SZ)
  DUMP=/var/backups/femiglow/pre-ma-ville-\$STAMP.dump
  sudo -u postgres pg_dump -Fc femiglow > "\$DUMP"
  test -s "\$DUMP"; log "sauvegarde base : \$DUMP (\$(du -h "\$DUMP" | cut -f1))"
  cp -p apps/web/.env "apps/web/.env.pre-ma-ville-\$STAMP"; log "copie .env : apps/web/.env.pre-ma-ville-\$STAMP"
  if secret_ok; then
    log "PRICE_QUOTE_SECRET déjà présent : inchangé"
  else
    # Généré sur place : le secret ne transite jamais.
    printf '\nPRICE_QUOTE_SECRET=%s\n' "\$(openssl rand -hex 32)" >> apps/web/.env
    secret_ok && log "PRICE_QUOTE_SECRET ajouté (pris en compte au prochain redémarrage)"
  fi
  # Source alignée sur ce qui va tourner (aucune compilation ici).
  git fetch -q origin $BRANCH
  git checkout -q -B $BRANCH FETCH_HEAD
  log "source : \$(git log --oneline -1)"
  log "PREPARATION TERMINEE : le site en ligne n'a pas changé"; exit 0
fi

# ── installer ────────────────────────────────────────────────────────────────
if ! secret_ok; then
  log "REFUS : PRICE_QUOTE_SECRET absent. Lancer d'abord : bash bin/deployer-kit.sh preparer"
  rm -rf apps/web/.next-build; exit 3
fi
cd apps/web
test -s .next-build/BUILD_ID
log "version à installer : \$(cat .next-build/BUILD_ID)"
# Sitemap et robots sont figés à la compilation : on garde ceux de la production.
cp .next/server/app/sitemap.xml.body .next-build/server/app/sitemap.xml.body
cp .next/server/app/robots.txt.body .next-build/server/app/robots.txt.body
chown -R --reference=.next .next-build

log "essai sur le port 8019, le site en ligne n'est pas touché"
sudo -u nodeapp env NODE_ENV=production NEXT_DIST_DIR=.next-build PORT=8019 \\
  node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 8019 > /tmp/essai-8019.log 2>&1 &
# Jamais de pkill par nom : seul le processus à l'écoute sur 8019 est visé.
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
# Page lue EN ENTIER avant la recherche : avec « set -o pipefail », un
# « curl | grep -q » échoue quand grep s'arrête au premier résultat (curl
# reçoit SIGPIPE, code 23) — faux négatif constaté le 11/11/2026.
page() { curl -s -m 30 "\$1" || true; }
contient() { # chemin motif libellé
  local html; html=\$(page "http://127.0.0.1:8019\$1")
  if grep -qF "\$2" <<<"\$html"; then log "  \$1 contient \$3 : oui"; else log "  \$1 contient \$3 : NON"; OK=0; fi
}
essai /api/health 200
essai /kit 200
essai /ar/kit 200
essai / 200
essai /legal/cgv 200
essai /sitemap.xml 200
essai /admin/login 200
essai /api/checkout/stock/pvar_ukmyfpxwh7tpp79z 200
essai "/api/delivery-cities/search?q=rab&limit=3&countryCode=MA" 200
CHUNK=\$(curl -s -m 30 http://127.0.0.1:8019/kit | grep -oE '/_next/static/chunks/[^"]+\\.js' | head -1)
essai "\$CHUNK" 200
contient /kit 'data-testid="delivery-estimate"' "la ligne livraison"
contient /kit 'à 45 MAD selon votre ville' "la fourchette lue en base"
contient /kit 'priceQuote' "le devis signé (secret chargé)"
contient /ar/kit 'data-testid="delivery-estimate"' "la ligne livraison (arabe)"
arreter; trap - EXIT
if [ "\$OK" != 1 ]; then
  log "ESSAI EN ECHEC : aucune bascule, le site n'a pas changé"; tail -15 /tmp/essai-8019.log
  rm -rf .next-build; exit 4
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
    && [ "\$(curl -s -o /dev/null -m 10 -w '%{http_code}' http://127.0.0.1:8011/ar/kit)" = 200 ] \\
    && grep -qF 'data-testid="delivery-estimate"' <<<"\$(page http://127.0.0.1:8011/kit)"; then
    log "OK : \$(cat .next/BUILD_ID) en ligne, précédent gardé dans .next-prev"
    log "retour arrière : cd /var/www/femiglow/apps/web && mv .next .next-failed && mv .next-prev .next && systemctl restart femiglow"
    log "FIN"; exit 0
  fi
done
log "ECHEC après bascule : retour à la version précédente"
rm -rf .next-failed; mv .next .next-failed; mv .next-prev .next
systemctl restart femiglow; sleep 5
log "retour : /kit → \$(curl -s -o /dev/null -m 10 -w '%{http_code}' http://127.0.0.1:8011/kit)"
exit 5
DISTANT

ssh "$HOST" "(nohup bash -c 'bash /root/deploy-kit.sh; echo code retour : \$?' > $LOG 2>&1 &) < /dev/null"

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
