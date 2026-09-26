# I Missed That — brand guideline (the prompt every design decision obeys)

## Who it is for, and how they should feel
For a hard-of-hearing adult sitting at their hearing family's table. Tired of reading captions like a stock ticker, tired of asking "what?", tired of being told "never mind".
They should feel: **seated at the table, not behind glass.** Calm, warm, included. The app is a quiet clerk at the table, not a screen you stare into.

## What it is
A place setting. The phone lies on the table like a placemat. It hands you the plan, the joke, and the question aimed at you, one thing at a time, in big warm type.

## What it must never be
- Not a caption app (no scrolling ticker, no wall of words).
- Not a medical device (no clinical white, no blue-and-grey dashboards, no ear icons).
- Not a productivity tool (no badges, no counters, no "insights").
- Not a chat app (no bubbles, no avatars in circles).
- Not a dark neon "AI" product (no glow gradients, no purple, no sparkles).

## Feel, in three words
Lamplight. Linen. Walnut.

## Materials (the mood board in words)
Sunday lunch at 1 pm. A walnut table with a soft pool of lamp light. Linen placemats, cream ceramic plates with a thin blue rim, a stoneware mug with tea, a brass table bell, a paper note under a fridge magnet, a folded napkin. Warm shadows, no hard edges. Everything slightly imperfect, handmade, matte.

## Palette (derived from the materials)
- Walnut `#5A3B22` (surfaces, the table)
- Lamplight `#F1C76A` (one accent, reserved for "asked you")
- Linen `#F3EBDD` (placemat, the reading surface)
- Ink `#2B2117` (text on linen)
- Cream `#F7F1E6` (text on walnut)
- Tea `#A8742A` (secondary accent, buttons, links)
- Blue rim `#6E8FB5` (the "you" marker only, never a UI accent)
- Shadow `#1B1410` (deep background under the table)
Semantic lamp states: calm green `#5D8A5E`, amber `#D99A3D`, red `#B8503A`. These are the only saturated colors and they mean one thing each.

## Type
- Display: Fraunces with SOFT 100, weight ~520 (rounded, Cooper-like), italic for the spoken sentence.
- Body: Nunito 500 at 18–22 px minimum on phone. Comprehension collapses above 170 wpm; nothing scrolls while someone speaks.
- Labels: Space Mono, small caps, wide tracking, for meta only.
- Feel: soft 90s warmth, nothing sharp.

## Layout rules (phone)
- One thing at a time. The placemat with the current sentence fills the top half. Below it, one card at a time: Asked you (if any) > Plans > Why they laughed. Swipe or tap to flip, never scroll a list while people are talking.
- Objects, not chrome. Buttons are things on the table: the bell (Asked you), the note (Plans), the popper (laughs), the mug (Speak for me), the placemat (Catch me up).
- Textures over flat fills: linen grain on the placemat, walnut grain on the table, paper on notes. Subtle, 3–6% noise, never a photo.
- Light from above-left. One shadow direction everywhere.
- Motion: things slide on the table (translate), they do not pop or fade. 180–240 ms. Reduced motion respected.
- Big tap targets, 56 px minimum. The phone lies flat, so hit areas are generous and labels are readable at arm's length.

## Voice
Plain, warm, second person. "Mom asked you: are you coming Sunday?" Never "notification", "transcript", "AI". The clerk never apologises and never explains itself.

## Non-goals for the demo
No onboarding tour, no settings maze, no dark/light toggle (the table is always lamplit).
