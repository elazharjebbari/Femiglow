#!/usr/bin/env bash
# Bascule de la prod FemiGlow sur la version kit-coherence (build déjà fait
# et testé dans /var/www/femiglow-next). À lancer en root sur le VPS.
# Retour arrière : bash 2026-10-switch-prod.sh rollback
set -euo pipefail

V=/usr/local/lsws/conf/vhosts/Example/femiglow.conf
DROPIN=/etc/systemd/system/femiglow.service.d/release-next.conf

health() {
  for i in $(seq 1 60); do
    c=$(curl -s -o /dev/null -w "%{http_code}" 127.0.0.1:8011/api/health || true)
    [ "$c" = 200 ] && { echo "health=200 après ${i}s"; return 0; }
    sleep 1
  done
  echo "health KO ($c)"; return 1
}

if [ "${1:-}" = rollback ]; then
  rm -f "$DROPIN"
  sed -i "s#/var/www/femiglow-next/apps/web/#/var/www/femiglow/apps/web/#g" "$V"
  systemctl daemon-reload && systemctl restart femiglow && health
  /usr/local/lsws/bin/lswsctrl restart
  echo "Retour à l'ancienne version fait."
  exit 0
fi

TS=$(date -u +%Y%m%d-%H%M%S)
OLDBIN=$(systemctl show femiglow -p ExecStart --value | grep -oE "/var/www/femiglow/node_modules/[^ ]+/next/dist/bin/next" | head -1)
NEWBIN=${OLDBIN/\/var\/www\/femiglow\//\/var\/www\/femiglow-next\/}
test -f "$NEWBIN"

cp -p "$V" "$V.bak-kit-coherence-$TS"
systemctl stop femiglow-preview 2>/dev/null || true
rm -rf /var/www/femiglow-next/apps/web/.next/cache/fetch-cache

mkdir -p "$(dirname "$DROPIN")"
cat > "$DROPIN" <<EOF
# Bascule kit-coherence ($TS) — supprimer ce fichier pour revenir à /var/www/femiglow
[Service]
WorkingDirectory=/var/www/femiglow-next/apps/web
ExecStart=
ExecStart=/usr/bin/node $NEWBIN start -H 127.0.0.1 -p 8011
EOF
sed -i "s#/var/www/femiglow/apps/web/#/var/www/femiglow-next/apps/web/#g" "$V"

systemctl daemon-reload
systemctl restart femiglow
health
/usr/local/lsws/bin/lswsctrl restart
echo "Bascule faite. Vhost sauvegardé : $V.bak-kit-coherence-$TS"
