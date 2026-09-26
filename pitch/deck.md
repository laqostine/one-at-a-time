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

<p class="big">Accessibility at a table is a contract. We're the clerk that holds both sides to it.</p>

For hard-of-hearing and late-deafened adults, in hearing rooms — work meetings, family dinners.

---

## Every accessibility tool puts the burden on one person

Read faster. Ask again. Get told "never mind." Today, the deaf person carries the whole contract alone.

<p class="quote">"I work in marketing and we have these weekly team meetings where everyone just talks over each other... I've started just nodding along even when I have no idea what was decided... I genuinely don't know what I signed up for."</p>
<p class="src">— r/deaf, 35↑</p>

<p class="quote">"Sometimes I didn't know how to respond because I wasn't even sure what exactly had been said... they assumed I was lying."</p>
<p class="src">— r/deaf, 25↑</p>

<p class="quote">"Asking people to repeat themselves a couple times and still not totally hearing or understanding them and then they say 'Never mind' or 'It's not important'."</p>
<p class="src">— r/hardofhearing, 13↑ thread</p>

---

## Why "just add captions" isn't enough

- **51.9%** of DHH live-caption users are frustrated with caption quality
- ASR lag of **1–2s** is rated *worse* than the errors themselves
- DHH caption comprehension drops above **170 wpm** — live group speech runs **160–220 wpm**
- Only **4%** of non-speech info (laughter, tone, applause) ever reaches a caption
- **96%** of deaf children are born to hearing parents — this is the default room, not the exception

<p class="src">Sources: pitch/citations.md</p>

---

## The contract

Accessibility at a table is a contract between everyone present. We're the clerk that holds both sides to it — Claude is the clerk any team can hire; the contract and the evidence are ours.

| The table's side | Your side |
|---|---|
| Join by phone (QR, no install) | Ledger — decisions **with the reason**, threads (who replied to whom) |
| Pace bar goes amber on overlap or speed | Addressed-to-you, the moment it happens |
| One-at-a-time nudge when it flaps | Away detection → catch-up card, on its own |
| | **Speak for me** — one tap, said in the next gap |
| | Doubt words — low-confidence words flagged, tap to ask for a repeat |

<p class="small">Ava does the mics. We do what the mics are for.</p>

---

## What's new

| Tool | What they already do | What nobody (before us) does |
|---|---|---|
| **Ava** | Phones join as named mics, speaker colors, type-to-speak | No ledger — the reason, the objection, the thread all vanish once said |
| **Otter / Zoom "Catch me up"** | Post-meeting or on-demand summary | Summary *resolves* the debate — drops the live objection while it's still open |
| **MS Teams** | Live captions + logged-in speaker names | Breaks on overlap; nothing addressed-to-you; no away detection |
| **Caption glasses** (XRAI, Captify, AirCaps) | Captions in your line of sight | Arms fight hearing aids/CIs; still just words — no state |
| **I Missed That** | — | Reasons, threads, addressed-to-you, away card, speak-for-me, doubt words |

<p class="src">Sources: research/06-github-landscape.md</p>

---

## How it works

```
phones (per person, named) ──► Deepgram, per-stream ASR ─┐
                                                          ├──► Claude — structured extraction
on-device gaze (no cloud) ──► "away" / "back" signal ────┘        (the ledger, never prose)
                                                                          │
                                                                          ▼
                                                        3 static cards + For-you nudge + Speak for me
```

Nothing is stored after the session — in-memory only, gone on close.

---

## Scope, limits, next

**Built for:** hard-of-hearing and late-deafened adults, in hearing rooms — work meetings, family dinners.

**Not built for:** sign-first Deaf users, classrooms with interpreters, gamers.

**Tested with:** not yet tested with a hard-of-hearing user.

**Next:** HoH user tests, Turkish, glasses as a display of the same feed.
