#!/usr/bin/env bash
set -e
source "$HOME/.nvm/nvm.sh"
nvm use 22 > /dev/null
exec pnpm --filter @femiglow/web dev
