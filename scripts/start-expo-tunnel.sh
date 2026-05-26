#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
  unset npm_config_prefix
  # shellcheck disable=SC1090
  source "$HOME/.nvm/nvm.sh" --no-use
  nvm use >/dev/null
fi

node "$ROOT/scripts/ensure-ascii-path.mjs"
exec npx expo start --tunnel --clear "$@"
