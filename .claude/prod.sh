#!/usr/bin/env bash
set -e
source "$HOME/.nvm/nvm.sh"
nvm use 20 > /dev/null
exec pnpm --filter @femiglow/web start --port 3000
