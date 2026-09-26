# 06 — GitHub and product landscape (research sprint, 2026-09-26)

Method: about 70 `gh search repos` / `gh api search/repositories` queries (the search API rate-limited at 30/min, so later queries were throttled), README pulls for about 20 candidate repos, and web searches for commercial products (Ava, Google Sound Notifications, Apple WWDC26, Zoom/Meet, XRAI/Captify/AirCaps, Hearing Buddy, CaptionsRush, Poised, Speaker Coach) and the relevant CHI/ASSETS research.
Stars and last-push dates are as of today. **"0-star, pushed 2026" = a student or hackathon repo.** Most of the DHH space on GitHub looks like this.

---

## 1. Repo inventory (relevant hits only)

### Live captions / diarization (engines and apps)
| Repo | ★ | Last push | What it does | Gap vs brief |
|---|---|---|---|---|
| Zackriya-Solutions/meetily | 31.1k | 2026-09-15 | Local AI meeting assistant: live transcription + summaries | Online meetings; no DHH lens, no "what did I miss" moment |
| QuentinFuxa/WhisperLiveKit | 11.1k | 2026-09-21 | Local streaming ASR + diarization + translation | Engine only |
| pyannote/pyannote-audio | 10.6k | 2026-09-24 | Diarization building blocks | Engine; ~1s+ latency, weak on crosstalk |
| google/live-transcribe-speech-engine | 1.5k | 2022-07-20 | Engine behind Android Live Transcribe | Stale; captions only, no structure |
| video-db/call.md | 1.4k | 2026-08-19 | Meetings → live agent loops (insights during calls) | Sales/online calls, not in-person DHH |
| six-ddc/livecaption | 168 | 2026-06-29 | macOS on-device captions + translation | Flat captions |
| andygmassey/telephone-and-conversation-transcriber | 130 | 2026-05-31 | Raspberry Pi caption appliance for a deaf dad (phone + room); big r/deaf response | Flat transcript; no attribution, no recap |
| Intent-Lab/GlassFlow | 89 | 2026-03-27 | Meta Ray-Ban live transcription, Deepgram diarization (S1, S2…) | Anonymous speaker labels, no memory |
| Deveraux-Parker/Parakeet_Multitalk | 60 | 2026-01-29 | Realtime multi-speaker STT interleave | Engine |
| JackyJiang08/ScribeAR-Realtime-Diarization | 1 | 2026-07-04 | Classroom captioning + stable speaker labels | Labels only |
| zredlined/voices-in-view-ios | 2 | 2026-08-18 | On-device in-person captions, iPhone | Flat |
| Akashdixit-12/live-caption-accessibility | 1 | 2026-04-06 | Captions + "important sentence detection" (ML) + CSV log | Closest to "salience" but it's a keyword toy |
| **DieRekT/huddle** | 0 | 2026-01-20 | **"Read the room": multiple phones as mic nodes → one room brain → merged transcript + AI summaries for a deaf viewer** | **Nearly the same architecture as our phone mics + catch-up.** Early, OpenAI-based, no ledger/pace |
| talberthoule/backchannel | 8 | 2026-09-25 | Live diarized transcript + agents that surface questions, objections, action items | **Nearest to our ledger**, but aimed at sales/meeting users, not DHH |
| kingzing89/Standin | 0 | 2026-07-23 | Google Meet: step away → catch-up summary when you return | Same "away → catch-up" loop, online only |
| lucaskwz/whatdidyousay | 0 | 2026-01-16 | "Instant Catch-Up for late joiners" meeting tool | Online, generic |
| oliyh/ketchup | 0 | 2016-04-23 | Concept: summarize what you missed, split distinct conversations, who said what | Never built (TODO list). The *only* repo naming "identify distinct conversations" |

### Sound awareness / sound history
| Repo | ★ | Last push | What it does | Gap |
|---|---|---|---|---|
| (product) Google Live Transcribe & **Sound Notifications** | — | active | 10 sounds offline, **12-hour scrollable sound timeline** | Has history, but no "where", no "still matters?", no link to what people said |
| (product) Apple Sound Recognition + **Name Recognition** (expanded WWDC26) | — | active | Alerts for doorbell/alarm/etc. and your spoken name | Point alerts, no history reasoning |
| Laura-Barsoum/DeafAccessibility | 0 | 2026-09-25 | BSc project: Whisper + AST + YAMNet + YOLO + DeepFace on one event bus with priority bands | Kitchen-sink alerts; no retrospective "what did I miss" |
| xyugen/sonavi | 10 | 2026-02-18 | On-device sound detection + IoT haptics (capstone) | Alert only |
| dylanbahenda/Gdg-AI-msi-hack, EmptyDeck/…Sound-Awareness-Device, quanle0709/SoundGuard_CED, changhoon-yoon/hearsafe (4-mic DOA glasses), stefanrubelov/sound-sight, Nidhi310305/deafguard, Karansehgal0611/SoundSenseHelmet, Reasondro/ImHEAR | 0–2 | 2025–26 | All "detect alarm/doorbell → vibrate/flash" | **Crowded and all alike.** None store sound events with lifecycle/relevance |
| WyzonXie/baby-monitor | 33 | 2026-09-17 | Alerts only when crying *persists* 3 min | Nice "does it still matter" heuristic, single class |
| Research: SoundWatch, ProtoSound (Jain, UMich Soundability Lab) | — | CHI'22 etc. | Watch alerts, few-shot personalized sounds | Research, alert-centric |

### Games: sound visualizers and voice-chat captions
| Repo | ★ | Last push | What it does | Gap |
|---|---|---|---|---|
| mmpneo/curses | 729 | 2024-06-18 | STT captions for OBS/VRChat/Twitch/Discord | Your own voice → captions, not team comms |
| inevolin/DiscordEarsBot | 83 | 2023-12-29 | Discord voice STT bot | Flat text |
| SakethKanchi/parley | 30 | 2026-09-04 | Discord bot: per-speaker transcripts + summaries after meetings | Post-hoc |
| lucaspla1/unmute | 0 | 2026-08-18 | **Discord voice captions as in-game overlay, named via Discord RPC speaking events** | Captions only. Callouts not parsed into player/location/objective |
| devarim28supply-afk/PhasmoSound-Mobile | 0 | 2026-09-21 | Phone as 2nd screen: game sound class + direction + "how long ago" + captions + 63-phrase board | Game-specific; closest thing to "sound history" for games |
| mike-s-zaugg/VisualAudioOverlay | 15 | 2026-09-08 | Fortnite-style directional radar overlay | Direction only |
| xxsniperGD/SoundRadar, soldan-dev/game-radar, Japour/sound_dir, wellforce-brandon/DeafDirectionalHelper, Alaanor/CanetisRadar2 | 1–12 | 2021–26 | 7.1 channel → direction radar | **Crowded** (5+ clones) |
| Vinventive/live-captions-vr | 7 | 2025-05-22 | SteamVR caption overlay | Flat |
| (products) Fortnite Sound Visualizer; Xbox/PS5/Switch 2 party-chat captions; Scripty; CaptionsRush (diarized game comms) | — | — | — | Nobody turns "two pushing B, one lit 80" into a structured, expiring callout |

### Glasses / AR captions
| Repo / product | ★ | What | Gap |
|---|---|---|---|
| Mentra-Community/MentraOS | 2.4k | Smart-glasses OS with live captions | Platform |
| Mentra-Community/LiveCaptionsOnSmartGlasses | 17 | Captions app | Flat |
| ComputerScienceHouse/caption-glasses + ~8 sibling student repos (DOA-captioning-glasses, g2-captions, soniox-translate…) | 0–3 | DIY caption glasses | Crowded hobby space |
| XRAI AR2, Captify (summaries + Ask AI premium), AirCaps (ex-TranscribeGlass) | — | Commercial caption glasses with speaker labels | Hardware; recap is add-on |

### Sign language (for completeness, crowded and off-brief)
sign/translate (794★), spoken-to-signed-translation (102★), plus hundreds of MediaPipe/CNN "ASL alphabet" repos (Devansh-47 318★, cortictechnology 39★…). **Saturated and not about recovering missed info.**

### Hearing-aid side
openMHA (333★), Tympan_Library (150★), thivyan-studios/hark-app (39★, hearing-aid streaming + transcription), tuckercr/wakewordapp "Hark" (34★, offline name/wake-word alert for HoH). DSP/amplification. Nobody does recall.

### Commercial conversation apps (the real competitors)
- **Ava**: QR/link so **each person's phone joins as a mic** with no download, colour-coded names, SpeakerID (up to 5), **type-to-speak** TTS. This is the incumbent for our phone-mic and interjection pieces.
- **Hearing Buddy** (iOS, built by a HoH dev): free captions, **name alerts**, **conversation summaries** of group talk.
- **Zoom AI Companion "Catch me up" / "What did I miss?"**, **Google Meet "Summary so far"** for late joiners. Online meetings only.
- **Microsoft Speaker Coach, Poised**: real-time pace feedback, but to the *speaker for their own benefit*.
- Research: **SpeechBubbles** (CHI'18, attribution + ordering of utterances), **HWD caption + speaker feedback to hearing partners** (CHI'24 EA), **Gaze-adaptive captions** (CHI'20, video).

---

## 2. Saturation map

| Sub-idea | Density | Notes |
|---|---|---|
| Live captions (phone/desktop/Pi) | **Very crowded** | Google, Apple, Ava, Otter, Hearing Buddy, hundreds of repos |
| ASL / sign recognition | **Very crowded** | Student-project default |
| Sound-event alerts (doorbell/alarm → vibrate) | **Crowded** | OS-level on Android and iOS, 10+ capstones |
| Directional game-sound radar | **Crowded** | 5+ near-identical repos + Fortnite native |
| Caption glasses | **Crowded** | MentraOS + many student builds + 3 funded startups |
| Speaker-labelled captions | **Crowded (products)** | Ava, XRAI, GlassFlow, Deepgram diarize |
| Post-hoc meeting summary / late-joiner catch-up | **Crowded (online)** | Zoom, Meet, Teams, meetily, call.md, Standin |
| Phones-as-named-mics for a room | **Taken** | Ava (product), DieRekT/huddle (repo) |
| Discord/game voice captions with names | **Emerging** | unmute, CaptionsRush, Scripty |
| Live decision/objection ledger | **Sparse** | backchannel (sales), not DHH, not in-person; post-hoc decision extractors exist (danieliser/take-minutes, AbdelStark/mistral-parler, n8n notes→tasks) |
| Sound *history with lifecycle* (ongoing/ended/where/resolved/still matters) | **White space** | Google has a flat 12h timeline; nobody reasons about relevance or links it to speech |
| **Parallel threads + who-replied-to-whom in spoken group talk** | **White space** | Only oliyh/ketchup (2016 TODO) and SpeechBubbles (ordering, not reply graph) |
| Game callouts → structured player/location/objective pins | **White space** | unmute stops at named captions |
| Listener-driven pace feedback on *speakers'* phones | **White space (products)** | CHI'24 research only; Speaker Coach/Poised are self-coaching |
| Interjection *timing* (when is it safe/still relevant to speak) | **White space** | Ava/PhasmoSound only offer type-to-speak/phrase boards |
| Laughter / reaction explainer ("why did everyone laugh?") | **White space** | Non-speech info is <4% covered by ASR (see 02) |
| Gaze/away-triggered catch-up in live in-person talk | **Near-white** | Standin does it for Meet tabs; CHI'20 gaze captions for video |

---

## 3. Five white-space ideas grounded in the brief

**A. Thread Lanes: "who replied to whom"**
- *What:* Each utterance is placed in a thread lane with a reply-to arrow ("Sam → answering Ana's Friday question"). Catch-up is grouped by thread: "2 conversations happened: (1) Friday plans, settled by Sam. (2) Dua's job news, still going."
- *Why nobody built it:* On mixed audio, diarization errors make reply graphs garbage. There are also no labelled datasets for spoken reply structure. **We already have clean per-phone named attribution**, which is the missing prerequisite. The reply-linking itself is a cheap Claude call over a rolling window.
- *Feasibility (7h):* **5/5.** It reuses the transcript stream. It needs one Claude structured-output call per N utterances (`thread_id`, `reply_to_utterance_id`) and a lane UI.
- *Demo moment:* Two people start a side conversation during the demo. The screen visibly splits into two coloured lanes with arrows, and "catch me up" answers per thread.

**B. Sound Ledger with "still matters?" state**
- *What:* Each phone runs an in-browser audio classifier (MediaPipe Audio Classifier / YAMNet, 521 classes). Each event gets *where* (which person's phone heard it loudest, e.g. "near Alex, kitchen side"), *when*, *duration*, and a *status*. Claude links it to speech around it: knock → Alex said "I'll get it" → **resolved**. A timer beeping for 40s with nobody reacting → **still active**.
- *Why nobody built it:* Classifiers don't understand context, and "where" usually needs a mic array. Distributed phones give coarse location for free, and joining sound with speech is novel.
- *Feasibility:* **3/5.** The browser classifier is fine, but false positives in a noisy hackathon room are a live-demo risk. Keep a replay fallback.
- *Demo moment:* Someone knocks on the table while the DHH user looks away. The card reads "Knock, near Alex's phone, 35s ago, resolved: Alex said he'd get it."

**C. Callout Board for games**
- *What:* Voice comms are parsed into expiring pins: {player, location, objective, time, TTL}, e.g. "Marina: 2 pushing B (18s ago)". Stale callouts fade out.
- *Why nobody built it:* Every game has its own vocabulary and maps, and building it needs game data. The niche knows unmute, but nobody has gone past captions.
- *Feasibility:* **2/5** for us. It is a different context from our table build and needs a map asset. It would be a pivot, not an add.
- *Demo moment:* A teammate shouts three callouts, and the minimap shows three pins with names and countdowns.

**D. "Why did everyone laugh?" reaction explainer**
- *What:* Laughter (YAMNet class, or the energy spike across several phones at once) triggers a pinned card that explains the lead-up in one line: "Laughing at Sam's joke that Ana's cat 'owns' the apartment."
- *Why nobody built it:* ASR drops non-speech, and humour explanation needs an LLM plus the last 20s of attributed context. The pain is well known (dinner table syndrome, the "never mind" brush-off) but it is invisible to engineers.
- *Feasibility:* **4/5.** Laughter detection via the classifier or a simultaneous-voicing heuristic we already compute (overlap).
- *Demo moment:* The table laughs, the DHH user taps the laugh card and gets the joke without asking.

**E. Silent "say again" ping**
- *What:* The DHH user taps a missed line. The speaker's phone privately buzzes "Bera missed that, could you repeat it?", and the DHH user gets Claude's best clarification of the garbled line in the meantime.
- *Why nobody built it:* It needs a phone per speaker (Ava has that infrastructure but no back-channel to speakers). It avoids the social cost of asking aloud.
- *Feasibility:* **5/5.** It reuses the participant socket and pace-bar buzz.
- *Demo moment:* A tap on a caption, and the speaker's phone lights up on stage.

---

## 4. Our components vs closest prior art

| Our component | Closest existing | Derivative risk |
|---|---|---|
| Live decision ledger | talberthoule/backchannel (live objections/action items), Zoom AI action items, call.md | **Low–medium.** Nobody targets in-person DHH or the "decided while you weren't looking" framing. Keep the framing sharp |
| Catch-me-up | Zoom "Catch me up", Meet "Summary so far", Hearing Buddy summaries, Captify, Standin, DieRekT/huddle | **High on its own.** Needs a twist (per-thread, anchored to *your* away moment) to not look like Zoom |
| Per-phone named mics | **Ava** (QR join, each phone a mic, colour names), DieRekT/huddle | **High.** Present it as infrastructure that enables attribution, not as the feature. Judges who know Ava will notice |
| Pace bar (listener-named, on speakers' phones) | Speaker Coach / Poised (self-coaching), CHI'24 HWD speaker-feedback study | **Low.** No product pushes "too fast for Bera" onto speakers' phones. A differentiator |
| Interjection assist | Ava type-to-speak, PhasmoSound phrase board | **Medium** if it is TTS/phrases, **low** if it is timing/relevance ("topic moved on, say 'going back to…'") |
| Away / gaze detection | Standin (tab-away on Meet), CHI'20 gaze-adaptive video captions | **Low.** Not seen in live in-person tools |
| Sound history | Google Sound Notifications 12h timeline, Apple Sound Recognition, 10+ alert repos | **High** if it is a timeline of labels, **low** if it has location + resolved/still-matters linked to speech (idea B) |

---

## 5. Verdict: **KEEP, and add one thing: Thread Lanes (idea A).**

Our core is the ledger, away-anchored catch-up and listener-named pace bar. It sits in sparse territory, and the phone-per-person setup gives us something almost no GitHub project or product has: clean, named, per-utterance attribution without diarization guesswork. The brief's first example is literally "parallel conversation threads and who replied to whom", and that is the one white space our infrastructure makes nearly free. Adding a Claude reply-linking pass and thread-grouped catch-up turns our most derivative piece (a catch-up that resembles Zoom's) into the most distinctive one. It costs about 3–4 hours, not a pivot. The phone-mic join flow should be de-emphasized in the pitch because Ava already ships it; say "because each voice arrives already named, we can reconstruct the conversation's structure". Do not chase sound history unless there are hours left over. If you do, build it as idea B (location + resolved state), never as a label timeline, because Google already ships that. If only 1–2 hours remain, the cheaper add is E (silent say-again ping), which reuses the pace-bar channel.

### Sources
- [Ava speakerID](https://help.ava.me/en/articles/9715516-speakerid-for-live-captioning-on-mobile-beta), [Ava group conversations](https://help.ava.me/en/articles/2752252-captioning-group-conversations-on-ava)
- [Google Sound Notifications timeline](https://chromeunboxed.com/android-sound-notifications-update)
- [WWDC26 hearing features](https://www.hearingtracker.com/news/apple-adds-new-captioning-and-hearing-accessibility-features-at-wwdc26)
- [Hearing Buddy](https://hearingbuddyapp.com/)
- [Zoom AI Companion catch me up](https://tldv.io/blog/zoom-ai-companion-review/)
- [Captioning glasses market](https://forum.hearingtracker.com/t/captioning-glasses-e-g-xrai-state-of-market-as-of-jan-26/110090)
- [Fortnite sound visualizer](https://accessibility-labs.com/feature-highlight-fortnites-sound-visualizer/), [CaptionsRush Discord](https://captionsrush.com/blog/discord-voice-chat-captions)
- [SpeechBubbles CHI'18](https://dl.acm.org/doi/abs/10.1145/3173574.3173867), [HWD speaker feedback CHI'24](https://doi.org/10.1145/3613905.3650976), [Gaze-adaptive captions CHI'20](https://dl.acm.org/doi/10.1145/3313831.3376266), [ProtoSound CHI'22](https://dl.acm.org/doi/10.1145/3491102.3502020)
- [Speaker Coach](https://support.microsoft.com/en-us/office/rehearse-your-slide-show-with-speaker-coach-cd7fc941-5c3b-498c-a225-83ef3f64f07b), [Poised](https://poised.com/)
