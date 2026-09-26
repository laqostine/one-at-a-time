#!/usr/bin/env bash
# One command for the stage: server + production bundle + named tunnel, each auto-restarted if it dies.
# Usage: bin/demo.sh            (Ctrl-C stops everything)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[ -f .env ] || { echo ".env missing (copy .env.example and add keys)"; exit 1; }
mkdir -p /tmp/imt
keep() { # keep <name> <cmd...>: restart on exit, 2 s backoff
  local name=$1; shift
  ( while true; do "$@" >>"/tmp/imt/$name.log" 2>&1; echo "[$name] exited, restarting in 2s" >>"/tmp/imt/$name.log"; sleep 2; done ) &
  echo $! >"/tmp/imt/$name.pid"
}
pkill -f "tsx watch src/index.ts" 2>/dev/null; pkill -f "vite preview" 2>/dev/null; pkill -f "cloudflared tunnel" 2>/dev/null; sleep 1
( cd client && npm run build >/tmp/imt/build.log 2>&1 ) && echo "client built" || { echo "client build FAILED, see /tmp/imt/build.log"; exit 1; }
keep server bash -c 'cd server && VOICEID_LOG=1 VOICEID_DUMP=1 npx tsx src/index.ts'
keep preview bash -c 'cd client && npx vite preview --host'
keep tunnel cloudflared tunnel --no-autoupdate run --url http://localhost:5174 imt-table
trap 'for p in /tmp/imt/*.pid; do kill "$(cat "$p")" 2>/dev/null; done; pkill -f "tsx src/index.ts"; pkill -f "vite preview"; pkill -f "cloudflared tunnel"; echo; echo stopped; exit 0' INT TERM
until curl -s localhost:8787/api/health | grep -q '"ok":true'; do sleep 1; done
T=$(curl -s localhost:8787/api/room | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
echo
echo "  Listener : https://table.akilion.ai/?me=<JudgeName>"
echo "  Phones   : https://table.akilion.ai/join.html?token=$T"
echo "  Backup   : https://table.akilion.ai/?replay=demo2&sound=1&away=1   (press A = looked away)"
echo "  Logs     : /tmp/imt/{server,preview,tunnel}.log"
echo
wait
