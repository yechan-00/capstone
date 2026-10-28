#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
  # Conda/base can set npm_config_prefix and break nvm.
  unset npm_config_prefix
  # shellcheck disable=SC1090
  source "$HOME/.nvm/nvm.sh" --no-use
  nvm use >/dev/null
fi

node "$ROOT/scripts/ensure-ascii-path.mjs"

PORT="${EXPO_DEV_SERVER_PORT:-8081}"

# Prefer LAN IP on en0; fall back to Expo auto-detect.
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [[ -n "$LAN_IP" ]]; then
  export REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP"
  echo "Using LAN IP: $LAN_IP"
fi

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo ""
  echo "  Port $PORT is already in use."
  echo "  Another Metro/Expo server may be running — stop it (Ctrl+C) and run npm start again."
  echo ""
  exit 1
fi

# Stale expo start processes (no listener on PORT) can block a fresh start.
STALE_EXPO="$(pgrep -f "$ROOT/node_modules/.bin/expo start" 2>/dev/null || true)"
if [[ -n "$STALE_EXPO" ]]; then
  echo ""
  echo "  Found a previous Expo process for this project (PIDs: $(echo "$STALE_EXPO" | tr '\n' ' '))."
  echo "  Stop it with Ctrl+C in that terminal, or run:"
  echo "    npm run stop && npm start"
  echo ""
  exit 1
fi

node "$ROOT/scripts/print-expo-links.mjs"

# --go: Expo Go QR (this project has no custom dev client build).
exec npx expo start --go --lan "$@"
