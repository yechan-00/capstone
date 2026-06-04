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

# Prefer LAN IP on en0; fall back to Expo auto-detect.
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
if [[ -n "$LAN_IP" ]]; then
  export REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP"
  echo "Using LAN IP: $LAN_IP"
  echo "Tip: QR은 Expo Go 앱으로 스캔하세요. Safari/브라우저에서 링크를 열면 expo-platform 오류가 날 수 있어요."
fi

exec npx expo start "$@"
