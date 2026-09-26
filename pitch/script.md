# Demo script (60 seconds) + judge Q&A cheat sheet

Roles: **Presenter** narrates. Two teammates play a table of hearing
people; a judge holds the listener phone. Each phone is its owner's mic —
attribution needs no diarization guessing. If Deepgram acts up, say so
and switch to `?replay=demo2` — it reproduces the exact same cards
deterministically.

## Timed script

**0:00** — Presenter hands a judge the listener phone.
> "Every accessibility tool puts the burden on the deaf person. We built
> the other side. Hold this."

**0:08** — Two teammates talk over each other about Sunday lunch.
- **Teammate A:** "So Sunday at one, right, everyone's coming—"
- **Teammate B:** "—wait, is it one or two, because I said I'd bring—"
*(Their phones turn amber. They stop.)* The judge's phone shows one
sentence, with a name: **"Dad: Sunday at one, everyone brings a side."**

**0:25** — A teammate says the judge's real name.
> "…are you coming Sunday?"

*(The judge's phone turns amber with the question.)*

**0:38** — The judge taps **"Say something"**, picks a line. It appears
on both teammates' phones. They read it aloud.

**0:50** — Close:
> "One sentence. One word on their phones. One tap. Ava does the mics.
> We do the other side of the table."

**Backup:** `?replay=demo2`

---

## Judge Q&A cheat sheet

**Q1: Who's speaking for me — what if it says something I didn't mean?**
> You pick the line and can edit it before it sends. It's autocomplete
> for the moment you're locked out of, not autopilot.

**Q2: Doesn't the amber light shame the fast talker?**
> It's amber; there is no red state — ambient light on their own phones, a mirror,
> not a scolding. Nobody has to say "one at a time" for the hundredth
> time; the light says it instead.

**Q3: Why not build for sign-first Deaf users?**
> Scoped out on purpose. Sign-first Deaf users are often better served by
> an interpreter or a full visual language — a different, well-served
> problem. We target hard-of-hearing and late-deafened adults in rooms
> full of hearing people, where nobody brings an interpreter to Sunday
> lunch.

**Q4: What if phones aren't possible?**
> It still works with one shared phone and a screen; you lose per-person
> amber lights and named speakers, not the one-sentence display or the
> "say something" tap.

**Q5: Are you recording people without consent — bystander privacy?**
> Nothing is stored after the session — in-memory only, gone on close.
> There's an always-visible listening indicator and a pause button.

**Q6: Isn't a phone at dinner just another screen?**
> One sentence at a time, no scrolling wall — it replaces looking at
> faces, not adds to it. It's built to let you look up sooner.

**Q7: What about other languages?**
> English, Italian, and Turkish end to end, verified on Deepgram's
> nova-3 streaming model.

**Q8: Why not just use Ava or Otter?**
> Ava gets you named mics from every phone — genuinely good, and we
> don't compete on it. Otter and Zoom summarize after the fact. Neither
> one has ever turned around and told the people talking to slow down.
> Ava does the mics. We do the other side of the table.

**Q9: What if Deepgram is down mid-demo?**
> `?replay=` needs neither key nor mic and reproduces the exact same
> cards deterministically. That's our live-demo insurance.

**Q10: Why family, and not work?**
> The numbers said so first: 56% say home with family is where hearing
> well matters most, against 21% for work. And a family will put their
> phones down for you in a way a client on a call never will.

**Q11: Where did the ledger go?**
> It's there — second layer, ask me to show it.
