#!/usr/bin/env bash
# Call a 21st.dev MCP tool over HTTP. Usage: tools/21st.sh <tool> '<json args>'
# Example: tools/21st.sh search '{"query":"bento grid dashboard","type":"component","limit":8}'
set -euo pipefail
K="${TWENTYFIRST_API_KEY:-$(grep '^TWENTYFIRST_API_KEY=' "$(dirname "$0")/../.env" | cut -d= -f2-)}"
curl -s https://21st.dev/api/mcp -H "x-api-key: $K" -H "content-type: application/json" -H "accept: application/json, text/event-stream" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":${2:-{\}}}}" \
| python3 -c '
import json,sys
raw=sys.stdin.read()
try: d=json.loads(raw)
except Exception:
    d=json.loads([l for l in raw.splitlines() if l.startswith("data:")][-1][5:])
r=d.get("result",d)
for c in r.get("content",[]):
    if c.get("type")=="text":
        t=c["text"]
        try: print(json.dumps(json.loads(t),indent=1))
        except Exception: print(t)
'
