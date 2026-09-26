#!/usr/bin/env bash
# Stable https for phones: table.akilion.ai -> localhost:5174 (named Cloudflare tunnel "imt-table").
# Use this instead of the quick tunnel on networks whose DNS blocks trycloudflare.com.
set -euo pipefail
exec cloudflared tunnel --no-autoupdate run --url http://localhost:5174 imt-table
