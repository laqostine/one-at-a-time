# Demo script (60 seconds) + judge Q&A cheat sheet

Roles: **Presenter** narrates. Two teammates play a table of hearing
people ("Dad" and "Sam" on their lamps); a judge holds the listener
phone. Each phone is its owner's mic, so every line is named without
diarization guessing. If Deepgram acts up, say so and switch to
`?replay=demo2`: it reproduces the exact same cards deterministically.

Deck: slide 1 is up while this runs. Slide 4 (the three phones) is the
backup if the room can't see the phones.

## Timed script

**0:00** — Presenter hands a judge the listener phone.
> "Every accessibility tool puts the burden on the deaf person. We built
> the other side. Hold this."

**0:07** — Two teammates talk over each other about Sunday lunch.
- **Dad:** "So Sunday at one, right, everyone's coming—"
- **Sam:** "—wait, is it one or two, because I said I'd bring—"

*(Both lamps go from green "Go ahead" to amber "One at a time". They
stop.)* The judge's phone shows one sentence, with a name:
**"Dad: Sunday at one, everyone brings a side."**

**0:15** — The tone beat.
- **Sam** (dry): "Great, another Sunday at your place, can't wait."

*(Above the line the judge's phone reads **Sam · TEASING**.)*
> Presenter: "That word is what a hearing person gets from the voice.
> Captions never had it."

**0:25** — Dad says the judge's real name.
> "…[Name], are you coming Sunday?"

*(The whole listener phone turns amber in under a second: "Dad asked
you", with Yes · Clarify · Can't.)*

**0:33** — The judge taps **Say something**, picks a line. It appears on
both lamps as "[NAME] SAYS". A teammate reads it aloud.

**0:45** — Close:
> "One sentence. One word on their phones. One tap. Ava does the mics.
> We do the other side of the table."

**0:53** — Presenter swipes the listener phone to **the map** and holds
it up for 5 seconds.
> "And this is where the conversation went."

*(End at 0:58–1:00. Leave the map on screen.)*

**Backup:** `?replay=demo2`

---

## Judge Q&A cheat sheet

**Q1: Who's speaking for me — what if it says something I didn't mean?**
> You pick the line and can edit it before it sends. It's autocomplete
> for the moment you're locked out of, not autopilot.

**Q2: Doesn't the amber light shame the fast talker?**
> It's amber; there is no red state. It's ambient light on their own
> phones, a mirror, not a scolding. Nobody has to say "one at a time"
> for the hundredth time; the light says it instead.

**Q3: How do you know the tone is right?**
> It's the same classifier that knows the line was for you. We show it
> only when it isn't neutral, and voice loudness and speed feed it.

**Q4: Why not build for sign-first Deaf users?**
> Scoped out on purpose. Sign-first Deaf users are often better served by
> an interpreter or a full visual language, a different, well-served
> problem. We target hard-of-hearing and late-deafened adults in rooms
> full of hearing people, where nobody brings an interpreter to Sunday
> lunch.

**Q5: What if phones aren't possible?**
> It still works with one shared phone and a screen; you lose per-person
> amber lights and named speakers, not the one-sentence display or the
> "say something" tap.

**Q6: Are you recording people without consent — bystander privacy?**
> Nothing is stored after the session: in-memory only, gone on close.
> There's an always-visible listening indicator and a pause button.

**Q7: Isn't a phone at dinner just another screen?**
> One sentence at a time, no scrolling wall. It replaces looking at
> faces, it doesn't add to it. It's built to let you look up sooner.

**Q8: What about other languages?**
> English, Italian, and Turkish end to end, verified on Deepgram's
> nova-3 streaming model.

**Q9: Why not just use Ava or Otter?**
> Ava gets you named mics from every phone. It's genuinely good, and we
> don't compete on it. Otter and Zoom summarize after the fact. Neither
> one has ever turned around and told the people talking to slow down.
> Ava does the mics. We do the other side of the table.

**Q10: What if Deepgram is down mid-demo?**
> `?replay=` needs neither key nor mic and reproduces the exact same
> cards deterministically. That's our live-demo insurance.

**Q11: Why family, and not work?**
> The numbers said so first: 56% say home with family is where hearing
> well matters most, against 21% for work. And a family will put their
> phones down for you in a way a client on a call never will.

**Q12: How does it know the table laughed?**
> No audio model. When two or more phones are voiced for most of a
> second at the same time and none of them produces words, that's the
> table laughing. The listener sees "the table laughed", so they're not
> the one person who missed that a joke happened.

**Q13: What's next?**
> Tests with hard-of-hearing users first; we haven't run one yet. Then a
> real voice on the phones (the ElevenLabs slot is wired). The look-away
> catch-up is already built: ask me to show it.
