#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PATTERN="$ROOT/node_modules/.bin/expo start"

PIDS="$(pgrep -f "$PATTERN" 2>/dev/null || true)"
if [[ -z "$PIDS" ]]; then
  echo "No Expo dev server running for this project."
  exit 0
fi

echo "Stopping Expo (PIDs: $(echo "$PIDS" | tr '\n' ' '))"
kill $PIDS 2>/dev/null || true
sleep 1

REMAINING="$(pgrep -f "$PATTERN" 2>/dev/null || true)"
if [[ -n "$REMAINING" ]]; then
  echo "Force stopping: $(echo "$REMAINING" | tr '\n' ' ')"
  kill -9 $REMAINING 2>/dev/null || true
fi

echo "Done. Run: npm start"
