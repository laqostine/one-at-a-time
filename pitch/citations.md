# Citations — pitch/deck.md, pitch/script.md, pitch/I-Missed-That-BAINSA.pptx

Source files: `research/09-niche-scale.md` (population numbers and the
claims list — never 430M, never "millions", say ">90%" not 96%, say
"hard-of-hearing and late-deafened"), `research/08-a-thursday-as-deniz.md`
(Crosstalk Lamp — the #1-picked solution in that persona sprint),
`research/07-reddit-wishlist-analysis.md` (N3: a discreet slow-down signal
is the top unmet need), `research/06-github-landscape.md` (nobody in the
landscape sends pace/overlap back to the hearing speakers' own phones),
and `research/reddit/threads.md` (verbatim quotes, subreddit + upvotes
only, no usernames).

## Slide 2 — the two verbatim quotes

1. **[35↑]** *"I've started just nodding along even when I have no idea
   what was decided. My boss mentioned something about a new client
   project last Thursday and I smiled and agreed but I genuinely don't
   know what I signed up for."*
   — r/deaf, thread "Anyone else struggling with group conversations at
   work…" (35↑ 10c). `research/reddit/threads.md` line 54. Shown on the
   slide with subreddit attribution only (r/deaf), no thread title or
   username.

2. **[36↑, family table]** *"DTS - Dinner Table Syndrome. Deaf people in
   hearing families are too familiar with this, myself included. It's
   simply too much work to follow along. Thats why you feel like you
   could sleep for a week, we have to work much harder than a hearing
   person to understand verbal conversations."*
   — r/deaf, thread "Exhausted and sad after family Sunday lunch" (36↑
   7c), reply at 15↑. `research/reddit/threads.md` lines 180, 203. Shown
   with subreddit attribution only (r/deaf).

## Slide 3 — the numbers

| Number on slide | Source | Note |
|---|---|---|
| **50 million** in the EU have trouble hearing, about **1 in 9** | `research/09-niche-scale.md` §1 | EU27 self-reported hearing loss, derived: the 59M Europe (EU27+UK+NO+CH) total [AEA/EFHOH/EHIMA "Getting the numbers right," 2024] minus UK (~7.4M) and NO+CH (~1.2M) ≈ 50M. Against an EU27 population of ~448M that is ≈11.1%, "about 1 in 9." Never call this a global or "millions more" figure — it is EU27 only, and it is our arithmetic on top of the source. |
| **Family table is the #1 place** they want to hear, **56%** vs. work **21%** | `research/09-niche-scale.md` §1, "Italy, where is it most important to hear well?" | EuroTrak Italy 2022 (n=1,317): "at home with family members" 56%, workplace 21%, school 5%. |
| Comprehension collapses **above 170 wpm**; group speech runs **160–220 wpm** | `research/05-numbers-for-pitch.md`, "Reading Speed vs. Conversational Pacing Gap" | From NotebookLM synthesis over published captioning-speed/comprehension research; exact paper titles were not captured verbatim in our research files, so this is reported as a synthesized, not primary-source-quoted, figure. |
| Only **4%** of non-speech information reaches captions | `research/05-numbers-for-pitch.md`, "Non-Speech Information (NSI) Deficit"; corroborated in `research/04-final-synthesis.md` pain #6 | Citing EEG studies (PMC7040021) and May et al. (2025). |

**Claims deliberately avoided on every slide** (`research/09-niche-scale.md`
§5): never "430 million deaf" (that WHO figure is disabling hearing loss
worldwide, mostly hard-of-hearing, not "deaf"); never "we'll help
millions" (the honest reach is ~10M addressable in the EU, a table
tonight); never plain "deaf" for our user — say "hard-of-hearing and
late-deafened"; never "96% of deaf children have hearing parents" as an
EU fact — that figure is US-sourced, child-focused data, and it isn't
used on this deck at all since our audience is adults.

## Slide 4 — how it works

Architecture (phones on the table → each phone is its owner's mic via
Deepgram, one stream per phone → server measures pace and overlap →
amber on the talkers' phones; the listener's phone shows one sentence
with a name; one tap sends text to every phone) matches the build's
stack: Deepgram nova-3 streaming ASR per phone, a server-side pace/overlap
gate, and an in-memory ledger — no storage after the session, per the
existing v2 build plan referenced across `research/08` and `research/09`
§4 ("Two changes to the current build so it fits the family table").
Latency targets (sentence under 1s, lamp under 2s) reflect the same build
plan's gate/ledger timing.

## Slide 5 — what's new

Built from the competitor rows in `research/06-github-landscape.md`:
- **Ava** does phones-as-mics for captions (§1: "QR/link so each person's
  phone joins as a mic... colour-coded names, SpeakerID... type-to-speak
  TTS"). It is the closest prior art to our phone-mic layer, and it stops
  at captions — it never sends a pace or overlap signal back to the
  hearing speakers' own phones.
- **Nobody pushes pace or overlap to the speakers' phones**:
  `research/06-github-landscape.md` §1 landscape table — every
  diarization/captioning repo and product found (meetily, WhisperLiveKit,
  pyannote, GlassFlow, huddle, backchannel, MS Teams captions) produces
  output for the listener only; none was found that turns crosstalk or
  pace into a signal shown to the people talking. Confirmed as the gap in
  `research/07-reddit-wishlist-analysis.md` N3 ("Nothing found. No
  product gives the room a shared pace signal or sends a discreet 'slow
  down' from the DHH user"), our single strongest unmet-need finding.
- **Otter / Zoom summarize after the fact**: `research/06-github-landscape.md`
  §1, "Zoom AI Companion 'Catch me up'... Google Meet 'Summary so
  far'... Online meetings only"; `research/07-reddit-wishlist-analysis.md`
  N2, "Otter, Grain and Fireflies do post-hoc summaries... Nothing gives a
  live 'what did I just miss' view."
- **Caption glasses put more on the deaf person**:
  `research/04-final-synthesis.md` matrix row "XRAI / AR Smart Glasses" —
  "head-locked text bouncing induces motion sickness; severe hardware
  conflict: arms physically collide with Behind-the-Ear (BTE) hearing
  aids/CIs." Still just words in front of one person's eyes, not a signal
  the table can act on.

## Slide 6 — scope, limits, next

- **Persona** (hard-of-hearing and late-deafened adults in hearing rooms,
  not sign-first Deaf users): stated per `research/09-niche-scale.md` §5's
  claims-to-avoid list, and the rank-1 group finding in §3 ("HoH adults at
  hearing family meals" scored highest of all group×moment combinations).
  Sign-first Deaf users are better served by an interpreter or a full
  visual language, a different, well-served problem — not a gap in our
  research, a deliberate scope line.
- **Not yet tested with a hard-of-hearing user**: stated as fact; no user
  test has been run as of this pitch (2026-09-26).
- **~10 million in the EU could use it**: `research/09-niche-scale.md` §4,
  "Honest estimate of how many people would be materially helped" —
  ~50M self-reported, cut to those with moderate-or-worse difficulty
  following groups, cut again to smartphone users under ~75.
- **Plans ledger and look-away catch-up already built as the second
  layer**: these are real, shipped parts of the same codebase
  (`research/08-a-thursday-as-deniz.md`'s "Crosstalk Lamp," "Punchline
  Card," and "Behind-You Buzz" solutions, and the ledger described
  throughout `research/09-niche-scale.md`) — kept off the main stage per
  this pitch's scope, surfaced only in Q&A.
- **Italian/Turkish verified**: `research/09-niche-scale.md` §4, "Italian
  and Turkish, end to end... verify that our Deepgram model and region
  support `it` and `tr` for streaming before the demo."

## Numbered sources (as shown on slide 6)

1. AEA / EFHOH / EHIMA, *Getting the numbers right on hearing loss, hearing
   care and hearing aid use in Europe*, 2024.
   https://www.ehima.com/wp-content/uploads/2024/03/Getting-the-numbers-right-on-Hearing-Loss-Hearing-Care-and-Hearing-Aid-Use-in-Europe-2024.pdf
2. EHIMA / Anovum, *EuroTrak Italy 2022*.
   https://www.ehima.com/wp-content/uploads/2022/11/EuroTrak_Italy_2022.pdf
3. Non-speech information in captions — EEG study, PMC7040021; May et al.,
   2025. https://pmc.ncbi.nlm.nih.gov/articles/PMC7040021/
4. Reddit, r/deaf, "Anyone else struggling with group conversations at
   work…" (35↑). https://www.reddit.com/r/deaf/comments/1r2797f/
5. Reddit, r/deaf, "Exhausted and sad after family Sunday lunch" (36↑).
   https://www.reddit.com/r/deaf/comments/1fh8h7h/
6. Reddit, r/deaf, "Dinner table syndrome and I want to cry" (174↑) —
   background reading on Dinner Table Syndrome, not directly quoted on
   this deck. https://www.reddit.com/r/deaf/comments/n8msyg/
