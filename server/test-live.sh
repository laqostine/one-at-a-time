#!/usr/bin/env bash
# Live test without humans: 3 synthesized phones (macOS `say` voices) stream the demo2 family lunch through
# Deepgram -> room -> host socket, and the host client's /api/gate, /api/state and /api/catchup calls are simulated.
# Passes when all 3 speakers produce >= 5 finals and at least one phone got a 'too_fast' or overlap pace message.
#
#   server/test-live.sh                      # own server on :8797 (room token "livetest"), normal turn-taking
#   server/test-live.sh --overlap --host     # extra fake-phones flags pass through (see tools/fake-phones.mjs)
#   BASE=ws://localhost:8787 server/test-live.sh   # use an already running server (its room gets 3 fake phones!)
#
# Needs DEEPGRAM_API_KEY (and ANTHROPIC_API_KEY for the Claude calls) in the repo .env, plus `say` and ffmpeg.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
PORT="${TEST_PORT:-8797}"
OUT="${OUT:-/tmp/imt-live-test.json}"
LOG="${LOG:-/tmp/imt-live-test-server.log}"
BASE="${BASE:-}"
SERVER_PID=""

cleanup() { if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null || true; pkill -P "$SERVER_PID" 2>/dev/null || true; fi; }
trap cleanup EXIT

if [ -z "$BASE" ]; then
  if curl -sf "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    echo "port $PORT is busy; set TEST_PORT or BASE" >&2; exit 2
  fi
  (cd "$HERE" && PORT="$PORT" ROOM_TOKEN="${ROOM_TOKEN:-livetest}" exec npx tsx src/index.ts) >"$LOG" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 40); do curl -sf "http://localhost:$PORT/api/health" >/dev/null 2>&1 && break; sleep 0.5; done
  BASE="ws://localhost:$PORT"
  echo "started test server on :$PORT (log $LOG)"
fi

HTTP="${BASE/ws/http}"
HEALTH="$(curl -sf "$HTTP/api/health" || true)"
if ! echo "$HEALTH" | grep -q '"hasDeepgram":true'; then
  echo "server at $HTTP is not up or has no DEEPGRAM_API_KEY: $HEALTH" >&2; exit 2
fi

node "$ROOT/tools/fake-phones.mjs" "$BASE" --scenario demo2 --voices Samantha,Daniel,Karen --json "$OUT" "$@"

node - "$OUT" "$ROOT/client/public/replay/demo2.json" <<'EOF'
const fs = require('fs');
const [out, scen] = process.argv.slice(2);
const s = JSON.parse(fs.readFileSync(out, 'utf8'));
const names = Object.values(JSON.parse(fs.readFileSync(scen, 'utf8')).names);
const fails = [];
for (const n of names) if ((s.finals[n] ?? 0) < 5) fails.push(`${n}: ${s.finals[n] ?? 0} finals (< 5)`);
const tooFast = Object.values(s.pace).reduce((a, p) => a + (p.too_fast ?? 0), 0);
if (tooFast + s.paceOverlapMsgs === 0) fails.push("no 'too_fast' or overlap pace message");
if (s.statusErrors.length) fails.push(`status errors: ${s.statusErrors.join('; ')}`);
const http5xx = Object.entries(s.http).filter(([k]) => / (5\d\d|ERR)$/.test(k));
if (http5xx.length) fails.push(`HTTP failures: ${JSON.stringify(Object.fromEntries(http5xx))}`);
console.log(`\nlive test: finals ${JSON.stringify(s.finals)} too_fast=${tooFast} overlapMsgs=${s.paceOverlapMsgs} state=${JSON.stringify(s.state)}`);
if (fails.length) { console.error(`FAIL\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log('PASS');
EOF
