# Demo script (90 seconds) + judge Q&A cheat sheet

Roles: **Presenter** narrates and holds the phone/laptop. **Alex, Sam, Priya**
are the three teammates playing the meeting (use real names/voices; each
phone is its owner's mic, so attribution needs no diarization guessing). If
Deepgram or the camera acts up, say so and press **A** to switch to
`?replay=demo1` — it reproduces the exact same cards deterministically.

## Timed script

**0:00–0:15 — the flip (before any card is on screen)**
> "Every accessibility tool puts the whole burden on the deaf person. Read
> faster. Ask again. Get told never mind. We built the other side."

*(A hearing teammate's phone is already visible on screen. As the presenter
says this line, two teammates start talking over each other — that phone's
pace bar goes amber. This happens before a single ledger card appears. The
burden flips first; the product shows up second.)*

**0:15–0:35 — the ledger fills**
- **Alex:** "Okay, quick sync — I think we ship the captions feature Friday."
- **Sam:** "Whoa, hold on — diarization still flaps, Monday is safer."
- **Priya:** "Also, open question — what are we charging for this?"
- *(On the deaf user's screen, cards fill live, no scrolling: a decision
  **with its reason** — "Ship Friday: diarization stable" — Sam's objection
  tagged **"Sam → to Alex,"** an open question, and a moment later a
  **"Changed"** tag when Priya moves the pricing review.)*
- **Presenter:** "Not a transcript. A decision with its reason. An
  objection addressed to a person, not the room. A question still open.
  And when something changes, it says so."

**0:35–0:55 — away, then back on its own**
- **Presenter** looks down at their phone. A pill on screen reads **"Away."**
- *(On-device camera, nothing sent anywhere, notices the presenter look back
  up.)*
- **Presenter** looks up. A card opens **by itself**: *"While you looked
  away (8s): Sam objected to Friday — wants Monday."*
- **Presenter:** "I didn't ask for that. It opened because I looked away and
  came back — that's the whole trigger."

**0:55–0:70 — addressed to you, then Speak for me**
- **Alex:** "Bera, can you own the demo script by Friday?"
- *(Phone buzzes. A "For you" card pulses: Alex asked you, right now.)*
- **Presenter** taps **Speak for me**, picks a line already queued —
  "Before we lock Friday, I want to flag the diarization bug" — and the
  laptop says it out loud in the next gap in the conversation.
- **Presenter:** "I didn't interrupt. It waited for the gap and said it for
  me."

**0:70–0:90 — close**
> "Not a transcript. The reason, the question aimed at you, the change, and
> a way back in. Ava does the mics. We do what the mics are for."

---

## Judge Q&A cheat sheet

**Q1: Who's speaking for me — what if the AI says something I didn't mean?**
> It never speaks anything you haven't picked and can edit first. Speak for
> me queues candidate lines from what's actually being said; you tap the one
> you want, you can edit it, and only then does it go out in the next gap.
> It's autocomplete for the moment you're locked out of, not autopilot.

**Q2: Doesn't the pace bar shame the fast talker?**
> It goes amber, never red, and it's framed as "pace, for [name]" not "you
> talk too fast." It's the same category of nudge Speaker Coach gives a
> presenter about themselves — we just point it at the room instead, since
> nobody else in that room needs to be told to slow down for themselves.

**Q3: Why not build for sign-first Deaf users?**
> Scoped out on purpose. Sign-first Deaf users are often better served by an
> interpreter or a full visual language — that's a different, well-served
> problem. We target the group stuck in between: hard-of-hearing and
> late-deafened adults who rely on spoken English in rooms full of hearing
> people, where nobody brings an interpreter to a Tuesday standup or a
> family dinner.

**Q4: What if phones aren't possible — a formal meeting, a doctor's office?**
> The clerk still works with one shared mic and the laptop screen; you lose
> per-person pace bars and named join, not the ledger, the reasons, the
> away detection, or catch-up. QR join is the frictionless path, not a hard
> requirement.

**Q5: You're recording other people without their consent — bystander privacy?**
> Nothing is stored after the session — in-memory ring buffer only, gone on
> refresh or close. There's an always-visible listening indicator and a
> pause button, the same disclosure bar Otter or Teams already puts in a
> room. The ledger self-destructs by design, which is also why we can say
> "nothing is stored" with a straight face.

**Q6: Three cards is a lot to track while also trying to follow a room.**
> They replace in place — no scrolling, no jitter — and each one has one
> job: Now is who's talking, Open on the table is state, For you is
> anything addressed to you. That split exists because a single scrolling
> transcript is exactly what caption comprehension research says breaks
> down above 170 wpm, which live group speech blows past routinely.

**Q7: This is all English — what about other languages?**
> Deepgram's streaming diarization supports dozens of languages, and
> Claude's extraction prompt doesn't hardcode English syntax — it's a
> config swap, not a rebuild. Turkish is the named next step, not a fantasy.

**Q8: Why not just use Ava or Otter?**
> Ava gets you named, colored mics from every phone — genuinely good
> infrastructure, and we don't pretend to compete on it. Otter and Zoom's
> "catch me up" give you a transcript or a summary after the fact. Neither
> tracks state while it's still open: a decision's reason, a live
> objection, a question aimed at you. Post-hoc summaries specifically
> resolve the disagreement you needed to see while it was still unresolved.
> Ava does the mics. We do what the mics are for.

**Q9: What happens if Deepgram or Claude is down mid-demo?**
> Two fallbacks, both rehearsed: `?replay=` needs neither key nor a mic and
> reproduces the exact same cards deterministically — that's our live-demo
> insurance. Short of that, it degrades to the browser's Web Speech API:
> you keep live captions, you lose speaker colors and ledger extraction
> until the connection's back. Neither is a crash.
