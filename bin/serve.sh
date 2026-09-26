#!/usr/bin/env bash
# Production serve: optimized client bundle on :5174 (proxies /api and /ws to the Fastify server on :8787).
# Run the server separately: cd server && npm run dev   (or npm start)
cd "$(dirname "$0")/../client" && exec npx vite preview --host
