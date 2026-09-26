---
marp: true
theme: default
class: invert
paginate: true
size: 16:9
---

<style>
section { font-family: 'Helvetica Neue', Arial, sans-serif; }
h1 { font-size: 2.2em; }
h2 { color: #8ab4f8; }
.quote { font-style: italic; border-left: 4px solid #8ab4f8; padding-left: 1em; margin: 0.6em 0; }
.src { font-size: 0.55em; opacity: 0.7; }
.big { font-size: 1.6em; font-weight: bold; }
.small { font-size: 0.7em; opacity: 0.85; }
table { font-size: 0.7em; }
</style>

# I Missed That

<p class="big">The dinner table where you're loved, and still locked out. We built the other side of it.</p>

For hard-of-hearing and late-deafened adults, at their hearing family's table — and the Monday meeting after it.

---

## Every accessibility tool puts the whole burden on the deaf person

Read faster. Ask again. Get told never mind. We built the other side.

<p class="quote">"Dinner table syndrome and I want to cry."</p>
<p class="src">— thread title, r/deaf, 174↑</p>

<p class="quote">"DTS - Dinner Table Syndrome. Deaf people in hearing families are too familiar with this, myself included. It's simply too much work to follow along. Thats why you feel like you could sleep for a week, we have to work much harder than a hearing person to understand verbal conversations."</p>
<p class="src">— r/deaf, "Exhausted and sad after family Sunday lunch," 36↑</p>

<p class="quote">"I'd say the hardest part for me as a Deaf person in a hearing family during the holidays is extreme dinner table syndrome."</p>
<p class="src">— r/deaf, "Christmas family diner experiences"</p>

---

## The numbers

In the EU, about **50 million** people say they have trouble hearing. Only about **a third** use hearing aids. And the place they most want to hear isn't the office — it's **the family table**.

- **56%** say "at home with family" is where hearing well matters most, vs. **21%** for the workplace <span class="src">— EuroTrak Italy 2022</span>
- In Italy: **1 in 8** people report hearing loss, and **more than 1 in 3** people over 75
- DHH caption comprehension drops above **170 wpm** — live group speech runs **160–220 wpm**
- Only **4%** of non-speech information (laughter, tone) ever reaches a caption
- **>90%** of deaf children have hearing parents — the hearing family table is the default room, not the exception

<p class="src">Sources: pitch/citations.md</p>

---

## The contract

Accessibility at a table is a contract between everyone present. We're the clerk that holds both sides to it — Claude is the clerk any family or team can hire; the contract and the evidence are ours.

| The table's side | Your side |
|---|---|
| Phones on the table become mics (QR, no install) | **Plans**, with the reason ("Sunday at nonna's" — who's bringing what) |
| Crosstalk lamp goes amber on overlap | **Asked you** — the moment someone asks, with a nudge and a buzz |
| One-at-a-time nudge when it flaps | **Why they laughed** — the joke, so you can laugh for real |
| | **While you looked away** — a card that opens itself |
| | **Say it as text** — one tap, appears on every phone at the table |

<p class="small">Ava does the mics. We do what the mics are for.</p>

---

## What's new

| Tool | What they already do | What nobody (before us) does |
|---|---|---|
| **Ava** | Phones join as named mics, speaker colors, type-to-speak | No plans, no "asked you," no "why they laughed" — the family layer vanishes once said |
| **Otter / Teams "Catch me up"** | Post-meeting or on-demand summary | Built for a meeting room, not a dinner table; resolves the debate instead of catching the joke or the ask |
| **MS Teams** | Live captions + logged-in speaker names | Breaks on overlap; nothing addressed to you; no look-away catch-up |
| **Caption glasses** (XRAI, Captify, AirCaps) | Captions in your line of sight | Arms fight hearing aids/CIs; still just words — no plan, no joke, no ask |
| **I Missed That** | — | Plans with why, asked-you, why-they-laughed, look-away catch-up, say-it-as-text |

<p class="src">Sources: research/06-github-landscape.md</p>

---

## How it works

```
phones on the table (placemat + one per person) ──► Deepgram, per-stream ASR ─┐
                                                                                ├──► Claude — structured extraction
on-device camera (nothing sent anywhere) ──► "away" / "back" signal ─────────┘        (the ledger, never prose)
                                                                                              │
                                                                                              ▼
                                                    Plans · Asked you · Why they laughed · look-away catch-up · say-it-as-text
```

Works in English, Italian and Turkish — verified on Deepgram nova-3. Nothing is stored after the session — in-memory only, gone on close.

---

## Scope, limits, next

**Built for:** hard-of-hearing and late-deafened adults, at a hearing family's table — the Monday meeting is the second scenario, not the first.

**Not built for:** sign-first Deaf users, classrooms with interpreters, gamers.

**Tested with:** not yet tested with a hard-of-hearing user.

**Honest reach:** ~10 million people in the EU could use this. Tonight, it reaches tens.

**Next:** hard-of-hearing user tests, a table mode for 65+ relatives, glasses as a display of the same feed.
