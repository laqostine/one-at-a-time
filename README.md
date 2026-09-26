# I Missed That
Live decision & commitment ledger for deaf and hard-of-hearing users at the table. Transcription tells you what was said. We tell you what you missed.

## Run
```
cp .env.example .env   # add ANTHROPIC_API_KEY, DEEPGRAM_API_KEY
cd server && npm run dev      # :8787
cd client && npm run dev      # :5174 (proxies /api and /ws to :8787)
```
Replay mode (no mic/keys for ASR): open `http://localhost:5174/?replay=demo2` (Sunday lunch: the family table, the primary demo; add `&speed=2` to hurry it). The work standup is still at `?replay=demo1`.
Plan: ~/.claude/plans/hidden-moseying-wind.md · Research: research/

## "Everyone joins" mode (no diarization guessing)
Each person at the table opens a link on their own phone and speaks into their own mic; their captions arrive on the host labelled with their real name.

1. Start server + client as above. The server prints `[room] Everyone joins → …/join.html?token=…` (random token, persisted in the OS temp dir so dev restarts keep it; pin it with `ROOM_TOKEN=…` in `.env`).
2. Phones need **https** for the mic, so run a tunnel: `bin/tunnel.sh` (needs `brew install cloudflared`). It prints `https://<random>.trycloudflare.com`.
3. Open the host app **from the tunnel URL**, tap the people icon in the header → QR + link (`<origin>/join.html?token=…`) and a live list of who joined with a speaking dot.
4. Participants scan, type their name, tap **Join**. They see a mic level + "You're being heard", can mute, and auto-reconnect on drops. They never see the transcript.

Wire details: `WS /ws/audio?role=participant&name=Alex&token=…` opens a per-phone Deepgram stream (`diarize=false`); transcripts go to the room's host socket(s) as `{type:'transcript', speaker: 100+n, name:'Alex', …}` (times rebased to the host stream). Hosts also get `{type:'participants', list:[{id,name,speaking}]}` on join/leave/speaking change. `GET /api/room` → `{token, joinUrl}`; `GET /api/room/verify?token=` → 200/401. Wrong token → HTTP 401 on the upgrade. Set `PUBLIC_URL` to make the server's printed/guessed join URL use your tunnel.

**Pace + crosstalk (participant phones).** Every 2 s each phone gets `{type:'pace', wpm, level:'ok'|'fast'|'too_fast', overlap, listenerName}`: wpm = words / minutes of speech over that person's final transcripts in the last 20 s (ok <150, fast 150–170, too_fast >170 — DHH caption comprehension drops above ~170 wpm); overlap = two or more sources (phones or the host mic) each voiced ≥300 ms in the same 1.5 s. Phones show a big green/amber/red bar ("Good pace for Bera" / "A bit fast for Bera, slow down" / "Too fast for Bera to follow", "Two people talking, one at a time helps Bera") and buzz once (max every 10 s). Hosts get `{type:'table', overlap, avgWpm}`. The host posts its name with `POST /api/room/me {name}` (else phones say "the table").

**Phones only.** Once a phone joins, the host mic stops sending audio by default (toggle in the Everyone joins modal) so lines aren't captioned twice. With the host mic on, a host-mic final is dropped if a phone final sharing ≥60% of its words arrives within ±2.5 s. A host with a saved name sees a **Start listening** button first (browsers need a click before the mic's AudioContext can run); `?replay=` auto-starts.

### Phones on a network that blocks trycloudflare.com
Some venue Wi-Fi refuses to resolve `*.trycloudflare.com`, so the quick tunnel "works" but no phone can load it (and the mic never prompts).
Use the named tunnel instead: `bin/tunnel-named.sh` serves the app at **https://table.akilion.ai** (Cloudflare tunnel `imt-table`).
Set `PUBLIC_URL=https://table.akilion.ai` in `.env` so the Everyone-joins QR uses it. Phones on mobile data also bypass the block.
