# I Missed That
Live decision & commitment ledger for deaf and hard-of-hearing users at the table. Transcription tells you what was said. We tell you what you missed.

## Run
```
cp .env.example .env   # add ANTHROPIC_API_KEY, DEEPGRAM_API_KEY
cd server && npm run dev      # :8787
cd client && npm run dev      # :5173 (proxies /api and /ws to :8787)
```
Replay mode (no mic/keys for ASR): open `http://localhost:5174/?replay=demo1`.
Plan: ~/.claude/plans/hidden-moseying-wind.md · Research: research/
