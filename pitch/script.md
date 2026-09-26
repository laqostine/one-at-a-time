# Demo script (90 seconds) + judge Q&A cheat sheet

Roles: **Presenter** narrates and holds the phone/laptop. **Alex, Sam, Priya**
play a family Sunday lunch — three teammates as relatives (use real names/
voices; each phone is its owner's mic, so attribution needs no diarization
guessing). If Deepgram or the camera acts up, say so and press **A** to
switch to `?replay=demo1` — it reproduces the exact same cards
deterministically.

## Timed script

**0:00–0:15 — the flip (before any card is on screen)**
> "Every accessibility tool puts the whole burden on the deaf person. Read
> faster. Ask again. Get told never mind. We built the other side."

*(A relative's phone is already visible on screen, lying on the table like a
placemat. As the presenter says this line, two relatives start talking over
each other — that phone goes amber. This happens before a single card
appears. The burden flips first; the product shows up second.)*

**0:15–0:35 — phones on the table, plans form**
- *(Phones on the table double as placemats/lamps. Two relatives overlap —
  their phones go amber together.)*
- **Alex:** "So are we doing Sunday at nonna's again?"
- **Sam:** "I can bring the dessert if someone else does the pasta."
- **Priya:** "I'll do the pasta, but not before 2."
- *(On the presenter's screen, a **Plans** card fills live, no scrolling:
  "Sunday at nonna's — Sam: dessert, Priya: pasta (after 2)," each with the
  reason attached.)*

**0:35–0:50 — the joke, and looking away**
- Someone tells a joke. The table laughs.
- *(A **"Why they laughed"** card appears: the last ~12 seconds, so the
  presenter gets the joke, not just the laughter.)*
- **Presenter** looks down at their phone. A pill reads **"Away."**
- *(On-device camera, nothing sent anywhere, notices the presenter look back
  up.)*
- **Presenter** looks up. A card opens **by itself**: *"While you looked
  away: Sam changed dessert to tiramisu."*

**0:50–0:70 — asked you, then say it as text**
- **Alex:** "Bera, are you coming Sunday?"
- *(Phone buzzes. An "Asked you" card pulses: Alex asked you, right now.)*
- **Presenter** taps a line already queued — "Bera wants to say: yes, I'll
  bring wine" — and it appears as **text on everyone's phone at the table**,
  voice optional.
- **Presenter:** "I didn't have to shout over the table. It just showed up
  where everyone was already looking."

**0:70–0:90 — close**
> "Not a transcript. The plan, the joke, the question aimed at you, and a
> way back in. Ava does the mics. We do what the mics are for."

---

## Judge Q&A cheat sheet

**Q1: Who's speaking for me — what if the AI says something I didn't mean?**
> It never speaks anything you haven't picked and can edit first. Say-it-as-
> text queues candidate lines from what's actually being said; you tap the
> one you want, you can edit it, and only then does it appear on the table's
> phones. It's autocomplete for the moment you're locked out of, not
> autopilot.

**Q2: Doesn't the crosstalk lamp shame the fast talker, or the loud aunt?**
> It goes amber, never red, and it's ambient light on the table's own
> phones — a mirror, not a scolding. Nobody has to be the one saying "one at
> a time" for the hundredth time; the lamp says it instead.

**Q3: Why not build for sign-first Deaf users?**
> Scoped out on purpose. Sign-first Deaf users are often better served by an
> interpreter or a full visual language — that's a different, well-served
> problem. We target the group in between: hard-of-hearing and late-
> deafened adults who rely on spoken language in rooms full of hearing
> people, where nobody brings an interpreter to Sunday lunch.

**Q4: What if phones aren't possible — a formal setting, a doctor's office?**
> The clerk still works with one shared mic and a laptop screen; you lose
> per-person crosstalk lamps and named join, not the plans, the asked-you
> cards, the look-away catch-up, or say-it-as-text. QR join is the
> frictionless path, not a hard requirement.

**Q5: You're recording other people without their consent — bystander privacy?**
> Nothing is stored after the session — in-memory ring buffer only, gone on
> refresh or close. There's an always-visible listening indicator and a
> pause button, the same disclosure bar Otter or Teams already puts in a
> room. It self-destructs by design, which is also why we can say "nothing
> is stored" with a straight face.

**Q6: Cards on a phone at dinner — isn't that just more screens at the table?**
> One card at a time, no scrolling wall, and it replaces looking at faces,
> not adds to it — that's the point of the "why they laughed" and "asked
> you" cards existing at all: they let you look up sooner, not later. And a
> shared screen in the middle of the table (table mode) is on the roadmap
> for relatives who won't read a phone.

**Q7: This is all English — what about other languages?**
> It works in English, Italian and Turkish end to end, verified on
> Deepgram's nova-3 streaming model. Family tables code-switch — nonna in
> dialect, kids in English — so lines are labeled per language, not forced
> into one.

**Q8: Why not just use Ava or Otter?**
> Ava gets you named, colored mics from every phone — genuinely good
> infrastructure, and we don't pretend to compete on it. Otter and Teams'
> "catch me up" give you a transcript or a summary after the fact, built for
> a meeting room. Neither one has ever heard of a plan forming, a joke
> landing, or a question aimed at you by name. Ava does the mics. We do
> what the mics are for.

**Q9: What happens if Deepgram or Claude is down mid-demo?**
> Two fallbacks, both rehearsed: `?replay=` needs neither key nor a mic and
> reproduces the exact same cards deterministically — that's our live-demo
> insurance. Short of that, it degrades to the browser's Web Speech API:
> you keep live captions, you lose the plans/asked-you/why-they-laughed
> extraction until the connection's back. Neither is a crash.

**Q10: Why family, and not work?**
> The numbers said so before we did: in the EuroTrak Italy survey, **56%**
> of people with hearing loss say home with family is where hearing well
> matters most, against **21%** for the workplace. And practically, a family
> will put their phones down for you in a way a client on a Zoom call never
> will. Work is the second scenario, not the first — it's where the same
> ledger becomes plans-with-reasons, an objection tagged to a name, and a
> question addressed to you instead of the room.
