#!/usr/bin/env bash
# v0 Platform API helper. Usage:
#   tools/v0.sh create "<prompt>"            -> prints chat id, web url, demo url; saves files to research/v0/<id>/
#   tools/v0.sh get <chatId>                 -> re-fetches and saves files
#   tools/v0.sh message <chatId> "<prompt>"  -> iterate on an existing chat
set -euo pipefail
K="${V0_API_KEY:-$(grep '^V0_API_KEY=' "$(dirname "$0")/../.env" | cut -d= -f2-)}"
OUT="$(dirname "$0")/../research/v0"; mkdir -p "$OUT"
api(){ curl -s "https://api.v0.dev/v1$1" -H "Authorization: Bearer $K" -H "content-type: application/json" "${@:2}"; }
save(){ python3 "$(dirname "$0")/v0_save.py" "$OUT"; }
case "$1" in
  create)  api /chats -d "$(python3 -c 'import json,sys;print(json.dumps({"message":sys.argv[1]}))' "$2")" | save ;;
  get)     api "/chats/$2" | save ;;
  message) api "/chats/$2/messages" -d "$(python3 -c 'import json,sys;print(json.dumps({"message":sys.argv[1]}))' "$3")" | save ;;
  *) echo "usage: create|get|message"; exit 1 ;;
esac
