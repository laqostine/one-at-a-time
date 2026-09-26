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
table { font-size: 0.75em; }
</style>

# I Missed That

**Transcription tells you what was said.**
**We tell you what you missed.**

A live decision & commitment ledger for deaf and hard-of-hearing users at the table.

---

## The pain isn't the words. It's what's around them.

<p class="quote">"I work in marketing and we have these weekly team meetings where everyone just talks over each other... I've started just nodding along even when I have no idea what was decided. My boss mentioned something about a new client project last Thursday and I smiled and agreed but I genuinely don't know what I signed up for."</p>
<p class="src">— r/deaf</p>

<p class="quote">"Not hearing the whole joke or the punchline in the moment at a table full of people so everyone is laughing but you, so you have to either ignore it, fake laugh, or ask them to repeat it while everyone is silent. Totally awkward."</p>
<p class="src">— r/hardofhearing</p>

---

## Why "just add captions" isn't enough

- **51.9%** of DHH caption users are frustrated with live captioning quality
- ASR lag of **1–2s** is rated *worse* than the errors themselves
- DHH caption comprehension drops above **170 wpm** — live group speech runs **160–220 wpm**
- Only **4%** of non-speech info (laughter, tone, applause) ever reaches a caption
- **96%** of deaf children are born to hearing parents — Dinner Table Syndrome is the default, not the exception

<p class="src">Sources: pitch/citations.md</p>

---

## What we built: the moment you missed, recovered

Situation: a meeting or dinner, phone on the table. Three static cards, not a transcript:

| Now | Open on the table | For you |
|---|---|---|
| who's talking, last line | decisions **with the reason**, objections, open questions, **changed instructions**, grouped by **thread** (who replied to whom) | the question **directed at you**, right now |

Plus **Catch me up** (2–3 bullets since you looked away), **Sound history** (knock, phone, laughter, with time-ago), and **laughter recovery** ("they laughed at Sam's Nokia line").

**State, not words.** The reason for a decision, the question aimed at you, the instruction that changed: recoverable in three seconds, without asking anyone to repeat.

---|---|---|
| who's talking + last line | decisions forming, objections, open questions | anything just addressed to you |

Plus **Catch me up** (2–3 bullets since you looked away) and **laughter recovery** ("they laughed at Sam's Nokia line").

**State, not words.** We track what changed, who owns what, and whether you were just asked something — not a wall of scrolling text.

---

## How it works

```
mic → Deepgram Nova-3 (streaming diarization) ─┐
                                                ├→ rolling 15-min ring buffer
YAMNet (in-browser, laughter/applause/etc.) ───┘        │
                                                          ▼
                                        Claude — structured extraction
                                    (extract_state / catch_me_up tools)
                                                          │
                                                          ▼
                                        3 static cards + For-you nudge
```

Diarized speech and non-speech events feed one shared timeline; Claude turns it into state, never prose.

---

## What's next — and the honest limits

**Next:** persistent speaker memory across sessions, on-device (no-cloud) mode, wearable haptic nudge, multi-language diarization.

**Limits, honestly:**
- Diarization still flaps on heavy crosstalk — we bias toward "someone" over a wrong name
- No Deepgram key → falls back to browser ASR, captions only, no speaker colors
- Nothing is stored after the session (privacy by design) — also means no long-term history yet
- Built and tested in 12 hours — this is a proof of the *idea*, not a hardened product
