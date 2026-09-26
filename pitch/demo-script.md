# Demo video — narration and shot list

Output: `pitch/demo.mp4` (1920x1080, 30 fps, ~78 s, English narration with burned-in subtitles).
Voice: macOS `say` "Samantha" at 168 wpm (the ElevenLabs key in `.env` is an API key *id*, not a key; the API refused it).
Sources: screen recordings of the running app at phone size (390x844 @2x), title cards in the brand type
(Fraunces italic, Nunito, Space Mono; cream #F4EEE2, ink #17130F, one amber #E4A73A word per card).
Numbers and quotes come from `pitch/citations.md`; nothing was invented.

| # | Shot | Length | On screen | Narration |
|---|------|--------|-----------|-----------|
| 1 | Hook card | 6.5 s | r/deaf quote (35 upvotes): "I smiled and agreed. I genuinely don't know what I signed up for." | Someone on r/deaf wrote this after a meeting. It happens at every family table too. |
| 2 | Problem card | 8.5 s | 50 million people in the EU say they have trouble hearing. 56% say the place they most want to hear well is at home, with family (work: 21%). Sources in the footer. | Fifty million people in the EU have trouble hearing. Asked where it matters most to hear well, they say: at home, with family. |
| 3a | Setup | 5.2 s | Listener phone: "Who is this phone for?" → I'm reading → "Teach the table your voice", Listening · 6…4 | One phone reads. It learns your voice in six seconds. |
| 3b | Setup | 4.2 s | Listening · 1 → "Got you, Bera." | Got you. Nothing to install. |
| 4 | The lamp | 15 s | Dad's phone as a lamp: green "Go ahead" → three synthetic phones talk over each other → amber "One at a time · one at a time helps Bera" → green again | Every other phone goes on the table and becomes a lamp. Green means go ahead. / When two people talk at once, their phones turn amber: one at a time. |
| 5a | One sentence | 4.2 s | Listener in the Sunday-lunch replay: "Dad · Remember the turkey incident of 2019…" with the tone word | The listener gets one sentence, with the name and the tone. |
| 5b | The ask | 10 s | Two phones side by side. Listener turns amber: "Mom asked you — Bera, are you coming Sunday?" Yes / Clarify / Can't. Tap Yes → Dad's lamp shows "BERA SAYS Yes." | When someone asks them a question, the whole screen turns amber. One tap, and the answer shows up on every phone. |
| 6 | Catch-up | 7.8 s | "SINCE YOU LOOKED AWAY · 7 S" with three lines (Mom, Dad, Joyce) | Looked away for a moment? Three lines catch you up. |
| 7 | Memory | 12.3 s | Places: map of Milan with amber pins → tap a pin → "BAINSA, Milan", date, Plans list | Every table is saved with its place and date: the plans, what was asked of you, what you missed. |
| 8 | Close card | 8 s | "One at a time. Nothing to wear. Nothing to install. The table does its part." table.akilion.ai | One at a time. Nothing to wear. Nothing to install. The table does its part. |

400 ms crossfades between shots; narration mixed at full level and loudness-normalised to -16 LUFS. No table audio (screen capture has none).

## Narration (≈140 words)

Someone on r/deaf wrote this after a meeting. It happens at every family table too.
Fifty million people in the EU have trouble hearing. Asked where it matters most to hear well, they say: at home, with family.
One phone reads. It learns your voice in six seconds. Got you. Nothing to install.
Every other phone goes on the table and becomes a lamp. Green means go ahead. When two people talk at once, their phones turn amber: one at a time.
The listener gets one sentence, with the name and the tone. When someone asks them a question, the whole screen turns amber. One tap, and the answer shows up on every phone.
Looked away for a moment? Three lines catch you up.
Every table is saved with its place and date: the plans, what was asked of you, what you missed.
One at a time. Nothing to wear. Nothing to install. The table does its part.

## How it was made

Intermediates in `/tmp/imt/demo/` (`shotA-setup.mjs`, `shotB-lamp.mjs`, `shotC-ask.mjs`, `shotD-places.mjs` record via a
CDP screencast at 2x; `cards/card.html` renders the cards, phone frames and subtitles; `build.sh` + `mix.sh` assemble with ffmpeg).
Entrances used: `/?menu=1&me=Bera`, `/join.html?token=…&voice=1&host=Bera` (+ `tools/fake-phones.mjs --overlap` for the amber),
`/?me=Bera&replay=demo2&away=1` (key A toggles "looked away"), and the Places page from the listener.
