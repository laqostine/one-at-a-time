# Citations — pitch/deck.md and pitch/script.md

Source: NotebookLM synthesis (`ea683452`, 51 indexed sources) via
`research/05-numbers-for-pitch.md` and `research/04-final-synthesis.md`,
plus the direct Reddit pulls in `research/reddit/threads.md` and
`research/reddit/wishlist.md`, and the landscape sprint in
`research/06-github-landscape.md`. Where the underlying paper/report title
isn't spelled out in our research files (they're cited there only as
bracketed numbers, e.g. `[3, 4]`), it's marked "from NotebookLM synthesis"
below — best-effort attribution, not a direct-quote-verified primary source.

## Slide 3 numbers

| Slide 3 number | Research file line | Best available source |
|---|---|---|
| **51.9%** of DHH live-caption users frustrated with caption quality | `research/05-numbers-for-pitch.md`, "Dissatisfaction with Live Captions" | Cited in NotebookLM synthesis as refs [3, 4] — a DHH caption-satisfaction survey; exact paper title not captured in our research files. From NotebookLM synthesis. |
| ASR caption lag **1–2s**, rated worse than errors | `research/05-numbers-for-pitch.md`, "ASR Caption Latency" + "Quantified User Rating Penalty for Latency" (1.14-point drop per ~7.5s of delay, 7-point scale) | Cited as refs [5, 7] (latency figure) and [17, 18] (rating-penalty figure). From NotebookLM synthesis; likely draws on published caption-latency/quality-rating studies not individually named in our files. |
| Comprehension caps at **170 wpm** vs **160–220 wpm** live speech | `research/05-numbers-for-pitch.md`, "Reading Speed vs. Conversational Pacing Gap" (145 wpm comfortable, 170 wpm drop-off) | Cited as refs [11, 12]. From NotebookLM synthesis — consistent with published captioning-speed/comprehension research (e.g. FCC/media-accessibility reading-rate studies); exact titles not captured in our research files. |
| **4%** of non-speech info reaches captions | `research/05-numbers-for-pitch.md`, "Non-Speech Information (NSI) Deficit" | Cited as refs [8, 9]; corroborated in `research/04-final-synthesis.md` pain #6, citing EEG studies (PMC7040021) and May et al. (2025) on non-speech-info coverage. **PMC7040021** is a real, checkable PubMed Central ID — worth using as the primary citation if asked directly. |
| **96%** of deaf children born to hearing parents | `research/05-numbers-for-pitch.md`, "Prevalence of DHH Children Born to Hearing Parents" | Cited as refs [1, 2]. This is a widely-published, well-established figure in Deaf-studies literature (commonly attributed to Mitchell & Karchmer-style demographic surveys of deaf children's family hearing status). From NotebookLM synthesis; exact source paper not named in our files. |

## Slide 2 quotes (verbatim, sources — no usernames shown to the audience)

1. *"I work in marketing and we have these weekly team meetings where everyone just talks over each other... I've started just nodding along even when I have no idea what was decided. My boss mentioned something about a new client project last Thursday and I smiled and agreed but I genuinely don't know what I signed up for."*
   — r/deaf, thread "Anyone else struggling with group conversations at work..." (35↑, 10c), user `Main_Lengthiness_606`. `research/reddit/threads.md` lines ~52-55.

2. *"Sometimes I didn't know how to respond because I wasn't even sure what exactly had been said. The lawyers kept cutting me off, and because I was overwhelmed and stumbling over my words, they assumed I was lying or making excuses."*
   — r/deaf, thread "Does anyone else struggle with live transcription..." (25↑, 12c). `research/reddit/wishlist.md` lines ~27-40. Used on the flip slide because it's the sharpest statement in the corpus of the trust problem — not slow captions, not missing words, but not being sure what was even said, while the burden of proving it stayed on the deaf user.

3. *"Asking people to repeat themselves a couple times and still not totally hearing or understanding them and then they say 'Never mind' or 'It's not important'."*
   — r/hardofhearing, thread "Common experiences amongst deaf/HOH people" (13↑ thread, 15c), user `HerNameIsRio805`. `research/reddit/threads.md` lines ~240, 296.

All three are attributed by subreddit only on the slide, no usernames shown to the audience, per instructions.

## Slide 4 ("the contract") feature sourcing

- **Ledger with reasons + threads (who replied to whom):** `research/06-github-landscape.md` §3, idea A "Thread Lanes" — identified as white space; only `oliyh/ketchup` (2016, never built) and CHI'18 SpeechBubbles touch reply structure, neither ships it.
- **Addressed-to-you:** driven directly by r/deaf "nodding along... don't know what I signed up for" (quote 1 above) and `research/07-reddit-wishlist-analysis.md` N2 (#1-ranked need, score 100/100).
- **Away detection → catch-up card:** `research/07-reddit-wishlist-analysis.md` N6 "gaze-away re-sync" demo idea, and N2's "look back at the last page to clarify" wish (r/deaf, 1p9z1e1, 13↑).
- **Speak for me:** `research/07-reddit-wishlist-analysis.md` N3 (#2-ranked need, score 100/100) — the lawyer-meeting story and the codesign wish for a discreet, non-interrupting way to respond; also `research/04-final-synthesis.md` pain #7 (the "never mind" brush-off).
- **Doubt words + repeat:** `research/07-reddit-wishlist-analysis.md`, "Biggest miss (within the top needs): transcript trust under pressure" — the lawyer-meeting quote ("I wasn't even sure what exactly had been said") plus "[Crowd noises], gee thanks app" (r/hardofhearing, 1qmgrz9) and the "cut and paste the unclear sentence" wish (r/deaf, 1rs0jq5). The report's own proposed fix (per-word Deepgram confidence, flagged for a one-tap repeat request) is what's on the slide.
- **Pace bar (table's side):** `research/06-github-landscape.md` §4, "listener-driven pace feedback on speakers' phones" scored **white space** — Speaker Coach/Poised only coach the speaker on themselves; nobody pushes a listener's pace need onto the room.
- **"Ava does the mics. We do what the mics are for.":** framing choice from `research/06-github-landscape.md` §4 and §5 — per-phone named mics are explicitly flagged "Taken (Ava, DieRekT/huddle)" and "High derivative risk," with the recommendation to "de-emphasize [it] in the pitch... say 'because each voice arrives already named, we can reconstruct the conversation's structure.'"

## Slide 5 ("what's new") sourcing

Built from the competitor rows and the "Our components vs closest prior art" table in `research/06-github-landscape.md` §1 (Commercial conversation apps) and §4:
- **Ava** row: `research/06-github-landscape.md` §1, "Ava: QR/link so each person's phone joins as a mic... colour-coded names, SpeakerID... type-to-speak TTS. This is the incumbent for our phone-mic and interjection pieces."
- **Otter / Zoom "Catch me up"** row: §1, "Zoom AI Companion 'Catch me up'... Google Meet 'Summary so far'... Online meetings only," and §4, "Catch-me-up... High [derivative risk] on its own. Needs a twist... to not look like Zoom."
- **MS Teams** row: `research/04-final-synthesis.md` matrix row "Microsoft Teams Captions" — "Drops text during overlapping speech; word flickering/instability; post-meeting summaries erase intermediate debate."
- **Caption glasses** row: `research/04-final-synthesis.md` matrix row "XRAI / AR Smart Glasses" — "Head-locked text bouncing induces motion sickness; severe hardware conflict: arms physically collide with Behind-the-Ear (BTE) hearing aids/CIs."

## Slide 6 ("how it works") and slide 7 (scope/limits) sourcing

- Architecture (phones → Deepgram per-stream → Claude structured extraction → cards; on-device gaze; nothing stored) matches the v2 build plan in `/Users/bera/.claude/plans/hidden-moseying-wind.md`, "v2 (after mentor feedback...)" section and the original stack notes (Deepgram Nova-3 streaming diarization, Claude `extract_state`/`catch_me_up` tool calls, in-memory ring buffer, "nothing stored after session" privacy design).
- Scope line ("hard-of-hearing and late-deafened adults... not built for sign-first Deaf users, classrooms with interpreters, or gamers") is the persona and exclusion the judge panel asked us to state honestly; the gaming exclusion is grounded in `research/07-reddit-wishlist-analysis.md` §"Biggest miss by category: gaming (N5)," scored lowest of the ranked needs (36/100) and explicitly called a pivot, not an add, in `research/06-github-landscape.md` idea C.
- "Tested with: not yet tested with a hard-of-hearing user" — stated per instructions; no user test has been run as of this pitch.
