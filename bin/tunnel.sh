#!/usr/bin/env bash
# Expose the Vite dev server (:5174, which proxies /api and /ws/audio to :8787) over https
# so participants' phones can use their mic ("Everyone joins" mode).
set -euo pipefail
PORT="${1:-5174}"
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found. Install it with:" >&2
  echo "  brew install cloudflared" >&2
  exit 1
fi
LOG="$(mktemp -t imt-tunnel.XXXXXX)"
cloudflared tunnel --no-autoupdate --url "http://localhost:${PORT}" >"$LOG" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true; rm -f "$LOG"' EXIT INT TERM
echo "Starting tunnel to http://localhost:${PORT} ..."
URL=""
for _ in $(seq 1 60); do
  URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)"
  [ -n "$URL" ] && break
  kill -0 "$PID" 2>/dev/null || { cat "$LOG" >&2; exit 1; }
  sleep 0.5
done
if [ -z "$URL" ]; then echo "Tunnel did not report a URL:" >&2; cat "$LOG" >&2; exit 1; fi
echo
echo "  Host (open this on the deaf user's device): ${URL}/"
echo "  Then tap the people icon -> 'Everyone joins' to show the QR (it uses ${URL})."
echo
echo "Ctrl-C to stop."
wait "$PID"
