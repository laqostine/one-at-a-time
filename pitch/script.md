# Demo script (90 seconds) + judge Q&A cheat sheet

Roles: **Presenter** narrates and holds the phone/laptop. **Alex, Sam, Priya**
are the three teammates playing the meeting (use your real names/voices —
diarization will pick up whoever is nearest the mic; tap-to-rename on stage
if it mislabels anyone). If room audio is too hostile, say so out loud and
switch to `?replay=demo1` — it reproduces the exact same cards.

## Timed script

**0:00–0:10 — Presenter (the problem)**
> "51.9% of deaf and hard-of-hearing caption users say they're frustrated with
> live captions. Not because the words are wrong — because captions don't
> tell you who said it, whether people just laughed at something, or that
> someone just asked *you* a question. Transcription tells you what was
> said. We built the thing that tells you what you missed."

**0:10–0:35 — live meeting (Alex / Sam / Priya talk over each other)**
- **Alex:** "Okay, quick sync — I think we ship the captions feature Friday."
- **Sam:** "Whoa, hold on — diarization still flaps, Monday is safer."
- **Priya:** "Also, open question — what are we charging for this?"
- **Presenter** (to camera, while captions render with speaker colors): "Watch
  the captions — colored by speaker, live. If it mislabels someone—" *(taps
  Sam's caption)* "—one tap, done. Sam's now Sam, not Speaker 1."
- **Priya:** "Can we soft-launch Friday and flip the flag Monday if it's stable?"
- **Presenter:** "Two threads at once now — the launch date and the pricing.
  'Open on the table' keeps them apart and shows who replied to whom, and
  the decision carries its *reason*: diarization still flaps."
- *(someone knocks on the table — a 'knock' chip lands in Sound history)*
- **Sam** (the joke): "Ship it on a Nokia 3310 and see who complains."
- *(laughter in the room — a 😂 chip appears on the timeline, unprompted)*

**0:35–0:50 — addressed-to-me nudge**
- **Presenter** looks away from the screen, note-taking.
- **Alex:** "Bera, can you own the demo script by Friday?"
- *(phone buzzes, "For you" card pulses)* **Presenter:** "I wasn't even
  looking at the screen. It just told me Alex asked me something — not
  after the meeting, right now."

**0:50–0:75 — Catch me up**
- **Presenter** presses **Catch me up**. Card fills in under 3 seconds:
  1. "Alex asked you to own the demo script by Friday."
  2. "Sam objected to Friday — diarization still flaps, wants Monday."
  3. "Priya: pricing review moved to Wednesday, Thursday is booked" (Changed).
- *(the laughter line shows as the joke bullet if the window is short)*
- **Presenter** taps the objection bullet → jumps to the verbatim line ±15s.
  "Every bullet is a receipt, not a guess."

**0:75–0:90 — close**
> "No wearables. Nothing for anyone else to install. Works for any meeting,
> any table, same mic. Not a transcript — what you missed, in three lines."

---

## 60-second judge Q&A cheat sheet

**Q1: What about bystander privacy — you're recording other people without consent?**
> Nothing is stored after the session — in-memory ring buffer, last 15
> minutes only, gone on refresh/close. There's an always-visible listening
> indicator and a pause button, same disclosure bar as any live-caption app
> (Otter, Teams) already uses in the room. We're not building a surveillance
> log — the ledger self-destructs by design, which is also why we can say
> "nothing is stored" with a straight face.

**Q2: Why not just use Otter.ai or Teams captions?**
> Those give you a transcript after the fact, or a scrolling wall of text
> during. Neither tracks state — a decision forming, a live objection, a
> question aimed at you — post-hoc summaries specifically drop the parts
> where people disagreed while it was still unresolved. Our extraction never
> resolves an open thread for you; it surfaces it. And Teams/Otter don't
> catch non-speech events (laughter, applause) at all — only ~4% of that
> info ever reaches a caption anywhere.

**Q3: How accurate is this in a noisy room?**
> Deepgram Nova-3 streaming diarization is what we lean on for speaker ID;
> it flaps on heavy crosstalk like any ASR does, which is exactly why the
> product doesn't trust the transcript alone — the ledger biases toward
> "someone at the table" over guessing wrong, and a one-tap rename/merge
> fixes a flapped speaker instantly. Worst case, captions degrade gracefully
> to ungrouped speech; the "for you" and catch-up logic still work off names
> people actually used in the sentence.

**Q4: What happens without a Deepgram key — is this a hard dependency?**
> It falls back to the browser's Web Speech API — you keep live captions,
> you lose speaker colors and diarization-based cards. That's a deliberate
> degrade path, not a crash. And `?replay=` mode needs neither key nor a
> mic at all — it's how we're demoing insurance against a bad room today.

**Q5: What's the business model / what's next?**
> Freemium: live captions + the three cards free, "Catch me up" and history
> beyond one session behind a subscription — this is the same shape as
> Otter's model, but built around state instead of a transcript archive.
> Next: persistent per-person speaker memory across meetings, a proper
> on-device mode for privacy-sensitive settings (legal, medical), and a
> wearable haptic nudge so the "for you" alert doesn't require looking at a
> screen at all.
