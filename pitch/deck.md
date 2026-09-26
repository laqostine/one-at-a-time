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

# One at a time.

<p class="big">The first accessibility tool for the hearing side of the table.</p>

BAINSA 2026 · Team: [Name] · [Name] · [Name] · [Name]

---

## Every accessibility tool puts the burden on the deaf person

Read faster. Ask again. Get told never mind. **We built the other side.**

<p class="quote">"I've started just nodding along even when I have no idea what was decided. My boss mentioned something about a new client project last Thursday and I smiled and agreed but I genuinely don't know what I signed up for."</p>
<p class="src">— r/deaf, 35↑</p>

<p class="quote">"DTS - Dinner Table Syndrome. Deaf people in hearing families are too familiar with this, myself included. It's simply too much work to follow along. Thats why you feel like you could sleep for a week, we have to work much harder than a hearing person to understand verbal conversations."</p>
<p class="src">— r/deaf, 36↑</p>

---

## The numbers

- **50 million** people in the EU say they have trouble hearing — about **1 in 9**
- **The family table**, not the office, is where they most want to hear: **56%** say home with family matters most, vs. **21%** for work <span class="src">EuroTrak Italy 2022</span>
- Caption comprehension collapses **above 170 wpm** — group speech runs **160–220 wpm**
- Only **4%** of sampled videos caption non-speech sound (laughter, tone)

<p class="src">Hard-of-hearing and late-deafened adults. Sources numbered on the last slide.</p>

---

## How it works

```
phones on the table
        │  each phone is its owner's mic
        ▼
   Deepgram — one stream per phone
        │  server measures pace and overlap
        ▼
amber on the talkers' phones ──── one sentence, with a name and how it was said,
                                  on the listener's phone (warm · teasing · annoyed)
                                          │  one tap
                                          ▼
                              text on every phone at the table
```

Sentence under **1 second**. Tone in **0.7 s**. Lamp under **2 seconds**. **Nothing is stored.**

---

## What's new

- **Ava** already turns phones into mics for captions
- **Nobody sends pace or overlap back to the speakers' own phones** — every other tool builds for the listener, none for the table
- **Otter / Zoom** summarize the conversation after it's over
- **Caption glasses** put more on the deaf person — words in front of one set of eyes, not a signal the table can act on

<p class="big">Ava does the mics. We do the other side of the table.</p>

---

## Scope, limits, next

**Built for:** hard-of-hearing and late-deafened adults, in hearing rooms.
**Not built for:** sign-first Deaf users.
**Tested with:** not yet tested with a hard-of-hearing user.
**Honest reach:** ~10 million people in the EU could use it. Tonight, it reaches a table.
**Next:** hard-of-hearing user tests. The plans ledger and look-away catch-up are already built as the second layer — ask to see them. Italian and Turkish verified.

<p class="small">
1. AEA/EFHOH/EHIMA, "Getting the numbers right on hearing loss in Europe," 2024 — https://www.ehima.com/wp-content/uploads/2024/03/Getting-the-numbers-right-on-Hearing-Loss-Hearing-Care-and-Hearing-Aid-Use-in-Europe-2024.pdf<br>
2. EHIMA/Anovum, EuroTrak Italy 2022 — https://www.ehima.com/wp-content/uploads/2022/11/EuroTrak_Italy_2022.pdf<br>
3. Non-speech info in captions, PMC7040021; May et al. 2025 — https://pmc.ncbi.nlm.nih.gov/articles/PMC7040021/<br>
4. r/deaf, "Anyone else struggling with group conversations at work…" (35↑) — https://www.reddit.com/r/deaf/comments/1r2797f/<br>
5. r/deaf, "Exhausted and sad after family Sunday lunch" (36↑) — https://www.reddit.com/r/deaf/comments/1fh8h7h/
</p>
