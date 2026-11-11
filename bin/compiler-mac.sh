#!/usr/bin/env bash
# Compile Femiglow sur le Mac avec les variables publiques de la production.
# Le serveur n'a plus la mémoire pour compiler (3,1 Go tués le 06/11/2026).
# Node 22 obligatoire : Node 24 fait échouer next/font.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/../apps/web"
# Next lit tout seul les fichiers .env*.local et .env.production au build : une
# config locale (base de test, secrets locaux) partirait dans la compilation
# de production. On refuse plutôt que de compiler avec.
for f in .env.local .env.production .env.production.local; do
  if [ -e "$f" ]; then
    echo "REFUS : apps/web/$f présent. Le déplacer hors du dépôt avant de compiler pour la prod." >&2
    exit 3
  fi
done
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
ssh alfenna "cd /var/www/femiglow/apps/web; cat .env .env.local 2>/dev/null | grep -E '^NEXT_PUBLIC_'" > "$TMP"
rm -rf .next
set -a; . "$TMP"; set +a
env -u DATABASE_URL NEXT_SKIP_TYPECHECK=1 NEXT_TELEMETRY_DISABLED=1 \
  NODE_OPTIONS=--max-old-space-size=6144 ./node_modules/.bin/next build
echo "compilé : $(cat .next/BUILD_ID)"
