# 07 — What DHH people say they wish existed (Reddit wishlist sprint)

Date: 2026-09-26. Time-boxed research sprint (30 min).

## Sources and method

| Step | What we did | Output |
|---|---|---|
| a | Ran 15 Google `site:reddit.com/r/...` queries through Apify `apify~google-search-scraper` (us/en, 10 results, 1 page) | `research/reddit/wishlist_hits.json`: 76 unique Reddit URLs |
| b | Pulled the full post and comments for 14 threads with `practicaltools~apify-reddit-api` | `research/reddit/wishlist_threads.json` (91 comments), verbatim digest in `research/reddit/wishlist.md` |
| c | Asked NotebookLM notebook `ea683452...` 2 questions (wishes verbatim; missed-info situations ranked) | Quoted below as [NLM] |
| + | Re-mined the earlier corpus `research/reddit/threads.md` for wish and abandonment phrases | Quoted as [prior] |

**Data caveats (read before quoting numbers):**
- 5 of the 15 queries returned 0 Reddit hits: `"I wish there was an app"`, `"someone should make"`, CochlearImplants restaurant, HearingAids meeting, and group chat multiple conversations. The literal "I wish X existed" phrasing is rare. People mostly say **"Is there an app that..."**. That phrasing is itself a wish, and it has 14 hits across the two subreddits.
- The first run hit Apify HTTP 402 (a concurrency limit) on 9 of the threads. They succeeded when retried with lower concurrency. 2 threads came back with empty bodies: the CaptionsRush launch post and "20 Deaf Problems".
- The "# people" column below counts distinct posters and commenters in our sample who voiced the need. These are directional counts, not survey data.

---

## 1. Needs, clustered from the wishes

### N1. "Tell me who said what, in a noisy group, without everyone installing something"
- **People:** ~12 in the sample. Also [NLM] rank #1 situation (family dinner) and rank #2 (work meeting).
- **In their own words:**
  - "I've tried using Notes with the microphone on and obviously it produces a run on account of the conversation **without breaking out who's talking**." (r/hardofhearing, 1lc7seg)
  - "Is there an app that works by having the device in the center of the table, picking up group member voices but *not* the background noises of other groups?" (r/deaf, 160nu2l, a book club in a bar)
  - "Transcription apps can work ok if: **Everyone has an individual microphone**, the microphone is close to the speaker... Group transcribe is a good option, but everyone should have it downloaded." (the top reply in the same thread)
  - "unless it's optimally quiet... the app is just gonna sit there not picking anything up, or uselessly be like [Crowd noises]. Gee thanks app." (r/hardofhearing, 1qmgrz9)
  - "I was getting whiplash trying to identify who was talking." [NLM / prior]
  - "I think we are all looking to make it easier to ID the speaker quickly and easily." (codesign participant) [NLM]
- **What they tried and why it failed:**
  - iPhone Live Listen: they confused it with Live Captions.
  - Notes dictation: no speaker labels.
  - Live Transcribe and Otter: noise, and one phone mic for the whole room.
  - Captify glasses: "fail due to internet connectivity and loud background noises".
  - Zoom trick (starting a call just to get captions): works, but it is clunky.
  - Group Transcribe: needs everyone to install it. The book-club host "feels a bit iffy telling people to download an app".
- **On the market:**
  - Ava does multi-phone captions with speaker labels, but it is paid.
  - Microsoft Group Transcribe works per phone, but it is iOS-first and needs an install.
  - SpeechCompass has direction arrows, but it is a research prototype.
  - **Unmet part:** a zero-install join (a QR code opening a web page) plus names on every line.

### N2. "I fell behind / nodded along. What was actually said or decided?"
- **People:** ~10 in the sample. [NLM] also lists latency as the #1 caption complaint.
- **In their own words:**
  - "I've started just **nodding along even when I have no idea what was decided**." (r/deaf) [prior/NLM]
  - "by the end of the meeting you'll find yourself **30 seconds to a minute behind**... the only thing I found they had in common were that they drove me mad!" (r/deaf, 17p9gfp)
  - "live captions always fail because they don't happen at the same time as the speech." (r/hardofhearing, top comment, 15 upvotes)
  - "sometimes I see reactions on screen, and I'm not sure why they're reacting... I then focus on trying to find out what happened but **forget everything else**." [NLM, latency study P2]
  - "we can **look back at the last page to clarify or re-read** what we already wrote." (r/deaf, 1p9z1e1, 13 upvotes; the commenter prefers written notes to captions for this reason)
  - "I would... **record the whole meeting to play back later**." (same thread)
  - "gives them the opportunity to **cut and paste a sentence or concept that is unclear**, and email it to you for clarification." (r/deaf, 1rs0jq5)
- **What they tried and why it failed:**
  - Live apps drift behind the conversation.
  - Otter and Grain summaries come after the meeting, "prone to errors", and are not available in the moment.
  - Writing back and forth works, but only with a willing counterpart.
  - Note-takers and recordings are available only in class.
- **On the market:** Otter, Grain and Fireflies do post-hoc summaries. **Nothing gives a live "what did I just miss, what's been decided so far" view that the DHH user controls.** This need is largely unmet.

### N3. "Give me time to respond / let me signal without interrupting"
- **People:** ~6 in the sample. The emotional intensity is the highest in the corpus.
- **In their own words:**
  - The lawyer meeting (r/deaf, 1p9z1e1, 25 upvotes): "reading subtitles, trying to keep up, aggressive tone, fast speech, pressure to respond immediately… **My brain just couldn't handle all of it at once.**"
  - "Sometimes I didn't know how to respond because **I wasn't even sure what exactly had been said**... they assumed I was lying."
  - "Subtly [let] the speaker know if something was unclear." [NLM, codesign participant] Users asked for **anonymous "slow down / caption garbled" buttons**.
  - "Give space for the interpreter to finish translating before expecting a response." (r/deaf, 1rs0jq5, 16 upvotes)
  - "I really want to contribute more but I feel like I'm always three steps behind." [prior]
- **What they tried and why it failed:** Asking people to write things down (they get tired of it), asking for "one speaker at a time" (it doesn't stick), and bringing an advocate or sister (they "didn't understand how to intervene").
- **On the market:** Nothing found. No product gives the room a shared pace signal or sends a discreet "slow down" from the DHH user.

### N4. "Something happened while I couldn't hear. What was it, where, and does it still matter?"
- **People:** ~9 in the sample (doorbell, knock, inspector, oven, parcel, dog). [NLM] rank #5 situation (home sounds).
- **In their own words:**
  - "I turn the corner and see **two strange men standing in my apartment**... Not sure if they tried knocking and ringing first, but from my dog's reaction I'm going to guess probably yes." (r/deaf, 13rkeo7, 63 upvotes)
  - "I worry about exactly this situation every day... walking out of the shower with nothing on to find someone there." (same thread)
  - "When you're expecting a parcel delivery, you **cancel your errands and appointments for the entire day to wait at the front door**." (r/deaf, 4y41b9)
  - "I still can't hear the oven tick." (r/deaf, 1583j5t)
  - "the hearing person suddenly looks off into the horizon... **why is the conversation being disrupted? I can't hear that**." [NLM, Daisy]
  - "For them, missing these contexts such as fire alarm can... be life threatening." [NLM]
- **What they tried and why it failed:**
  - Flashing doorbells: the landlord has to install one, and they only cover a single source.
  - A dog used as a sound detector.
  - Smart devices that push to a watch: this works, but it takes separate hardware for every source.
  - Hearing aids are removed while sleeping or showering, which is exactly when the knock comes.
- **On the market:**
  - iOS Sound Recognition: live alerts only, no history.
  - Android Sound Notifications: has a short history.
  - Flashing-light systems.
  - **Unmet part:** a timeline that answers "what happened while I was asleep or in the shower, and is it still relevant?" (for example: knock at 07:12, repeated 3 times, then silence, so probably a delivery attempt).

### N5. "Voice chat / audio cues in games"
- **People:** ~7 in the sample.
- **In their own words:**
  - "Sadly, there **aren't any Speech-To-Text Programs that could be used for gaming** that I am aware of." (r/deaf, axspeb)
  - "I was hoping Discord could auto-caption what a friend is saying while playing a game together." (r/hardofhearing, ncvsv8)
  - "a lot of [games] only voice chat or nothing at all." (r/deafgamers, a hearing boyfriend of a deaf gamer)
  - "Is there really no stereo audio to vibration translator?" (r/deaf, xcxkz3, for Rainbow Six Siege)
  - "I use a **visual sound meter overlay for each stereo channel** so I can see which direction gun fire is coming from." (same thread)
  - The CaptionsRush developer asks: "just critical callouts, or everything said by teammates?"
  - "Everytime the family gets together... I hide in my room and play games." [NLM]
- **What they tried and why it failed:**
  - Live captions running on a second monitor: "take a look for reference".
  - Chrome Discord with live captions plus `/transcribe` bots.
  - Haptic vests (Woojer, bHaptics) and ButtKicker: "pile of unused toys", "awkward to set up", and the vendors disappear.
  - Asus Sonic Radar and Audio Radar.
- **On the market:** CaptionsRush (open beta since 02/2026: voice-to-text overlay), Discord transcription bots, Audio Radar hardware. **Partially served, and a crowd of indie builders is working on it.**

### N6. "Lectures move faster than my interpreter or captions, and I can't watch the board at the same time"
- **People:** ~8 in the sample. [NLM] rank #3 situation.
- **In their own words:**
  - "Deaf people **can't watch both the Interpreter and the board at the same time**... Explain first, then write." (r/deaf, 1rs0jq5)
  - "lecturers walk all around the room... I face away from all of the people when using the computer... I'm almost unreachable." (r/deaf, 1og9m9x)
  - "Voice to text has been helpful but relies on my phone having enough battery, and isn't always accurate."
  - "Last time I took a class with a professor with a strong accent **I failed it** due to missing much of the lecture material." (r/deaf, eqo7mg)
  - "DHH students focused only 10% on/around the instructor, 14% on slides." [NLM, eye-tracking review]
- **What they tried:** CART, interpreters, note-takers, Zoom recordings of class, Live Transcribe with mixed languages (it fails on code-switching).
- **On the market:** CART, Otter for Education and Verbit are well served for review after class. The unmet part is the *in-the-moment* re-sync after looking away.

### Minor needs (not ranked)
- Phone-only door or intercom entry (1ajq0m6).
- Free captions without hour caps: "Otter... the shortage runs out so fast" [NLM].
- Caption control: toggle list, placement, no censoring [NLM].
- Offline or poor-internet transcription (1hxcj6e).

---

## 2. Ranking: intensity × unmet × feasible in 7 hours (Claude + Deepgram + browser)

Each factor is scored 1 to 5.

| # | Need | Intensity | Unmet | Feasible in 7h | Score |
|---|---|---|---|---|---|
| 1 | **N2 Catch-up: what was said or decided while I fell behind** | 5 | 4 | 5 | **100** |
| 2 | **N3 Pace / discreet signal / time to respond** | 5 | 5 | 4 | **100** (fewer voices than N2, so ranked second) |
| 3 | **N1 Who said what, in noise, zero-install** | 5 | 3 | 4 | **60** |
| 4 | **N4 Sound history: what happened, where, does it still matter** | 4 | 3 | 4 | **48** |
| 5 | **N5 Game voice callouts** | 4 | 3 | 3 (needs desktop audio capture) | **36** |
| 6 | **N6 Lecture re-sync after looking away** | 4 | 2 | 4 | **32** |

## 3. One product idea and a 30-second demo moment per top need

1. **N2 Catch-me-up plus a live decision ledger.**
   - Idea: a sidebar keeps a running list of "Decided / Open question / Action (owner)". A "What did I miss?" button summarises everything since the user's last glance, in 3 lines.
   - **Demo:** Three teammates argue about the launch date for 20s while the deaf user looks at their laptop. They tap *Catch me up* and see: "Ali proposed moving the launch to Friday. Zeynep objected (QA not done). **Undecided.** Ali asked you directly: *can design ship by Thursday?*" The last line is the killer: **"someone asked you a question"**.
2. **N3 Pace bar plus an interjection assist.**
   - Idea: every participant's phone shows a shared "caption lag / pace" bar. When the DHH user taps *hold on*, all phones pulse amber: "Give Bera 5s". The assist drafts a reply to the last question, which the user can edit and speak with TTS.
   - **Demo:** A fast talker rattles on and the pace bar goes red. The deaf user taps once, every phone shows "slow down, please", and the speaker visibly pauses. The pause itself is the demo.
3. **N1 Per-phone named mics (a QR join in the browser).**
   - Idea: everyone scans a QR code, types their name, and their phone becomes their personal mic. The transcript is attributed per phone, so it needs no diarization guessing and ignores the next table's noise.
   - **Demo:** Play bar noise from a speaker. The single-phone Live Transcribe view shows "[crowd noise]", while the named-mic view shows clean lines: "Zeynep: ...", "Ali: ...".
4. **N4 Sound history timeline with "still matters?" triage.**
   - Idea: an always-on page classifies sounds (YAMNet in TF.js, or a Deepgram and Claude label) and logs them to a timeline. Claude marks each one as "resolved / still relevant / urgent".
   - **Demo:** The user "takes a shower" (the screen is covered). Someone knocks 3 times, then the microwave beeps. When the screen is uncovered, the timeline shows: "07:12 Knock ×3 at the front door. No follow-up, so **probably a missed delivery, check the door**. 07:14 Microwave done, **still waiting**."
5. **N5 Callout-only game overlay.**
   - Idea: a browser tab captures Discord or game audio (`getDisplayMedia` with audio). Deepgram transcribes it and Claude filters it down to tactical callouts only ("2 on B site", "rotate", "low HP"), shown large at screen centre and colour-coded by teammate. Banter is dropped.
   - **Demo:** A 20s voice clip mixes jokes with "enemy behind you left". Only the callout flashes on screen, with an arrow.
6. **N6 Gaze-away re-sync.**
   - Idea: when the webcam detects that the user looked at the board or interpreter, the page marks the point where they looked away. When they look back, the missed sentences since that point are highlighted.
   - **Demo:** The user looks at a whiteboard for 8s. Looking back, a yellow block shows "While you were away: *'this term is on the exam'*".

## 4. Does the current build hit the top needs?

| Build feature | Needs it hits | Verdict |
|---|---|---|
| Live decision ledger + catch-me-up | N2 (the #1 need) | **Direct hit.** It is the strongest match to "nodding along with no idea what was decided". |
| Per-phone named mics | N1 | **Direct hit.** It uses the community's own fix ("everyone has an individual microphone"). A browser join removes the "iffy asking people to install an app" barrier. |
| Pace bar + interjection assist | N3 | **Direct hit.** It matches the codesign wish for an anonymous "slow down" and the lawyer-meeting story. |
| Gaze "away" detection | N2 and N6 | Good. It turns catch-me-up from a button into something that happens automatically when you look away. |
| Sound history | N4 | Hit, but only if it runs **when the user isn't in a conversation** (asleep, showering, aids out). The evidence is about home and alone moments, not meetings. If it is framed as a meeting sidebar only, it misses the need. |

**Coverage:** 5 of the top 6 needs are touched. The build is well aimed at the highest-scoring needs.

**Biggest miss (within the top needs): transcript trust under pressure.** The most intense story in the corpus (the lawyer meeting) is not about speed. It is "**I wasn't even sure what exactly had been said**", and it recurs in "isn't always accurate", "[Crowd noises], gee thanks", and "scrambles words". None of our features tells the user *which words to doubt*.
- Cheap fix, about 1 hour: Deepgram returns per-word `confidence`. Underline or grey low-confidence words, and give each flagged word a one-tap "ask them to repeat this" card with the exact quote pre-filled. This reuses the interjection assist.
- It also serves the "look back at the last page / cut and paste the unclear sentence" wish.

**Biggest miss by category:** gaming (N5), the brief's own third example, has zero coverage. It is lower-ranked because CaptionsRush and Discord bots already exist, and desktop audio capture is a risk for a 7-hour demo. If time allows, a stretch is a "callout-only filter" mode on the existing pipeline (Claude prompt: keep only tactical or imperative utterances) fed from a shared browser tab.

## Files
- `research/reddit/wishlist_search.py`: Google site-search via Apify.
- `research/reddit/wishlist_threads.py`, `wishlist_retry.py`: thread fetch.
- `research/reddit/wishlist_hits.json`: 76 Reddit URLs with snippets.
- `research/reddit/wishlist_threads.json`: 14 threads, 91 comments.
- `research/reddit/wishlist.md`: verbatim digest (title, url, body, top 10 comments with upvotes).
