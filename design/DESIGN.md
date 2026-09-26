# One at a time — DESIGN.md

The whole design in one rule: **one sentence, one word, one button.** If a screen has more than that, something is wrong.

## What it is
Three phones on a table. Two belong to hearing people and are lamps. One belongs to the hard-of-hearing person and is a page. The app has no chrome, no cards, no icons, no mascot, no textures. It is typography on cream, and color on the lamps.

## Tokens
```
--cream    #F4EEE2   page background (listener, landing, join form)
--ink      #17130F   text
--ink-2    #5E554B   secondary text (names, state word, footnotes)
--rule     #D9D0C0   hairline (1px) where a separation is unavoidable
--amber    #E4A73A   the only accent: "asked you", "one at a time", the button
--go       #4C8C5C   lamp: go ahead
--stop     #B8402E   lamp: too fast
--night    #17130F   lamp text on colored screens is cream; on cream screens ink
```
No gradients. No shadows. No borders except `--rule`. No rounded corners above 12px except the one button (999px pill).

## Type
```
display   Fraunces, opsz 144, SOFT 100, wght 500, italic     sentences, the big word, the wordmark
body      Nunito 500 / 700                                  names, buttons, paragraphs
label     Space Mono 500, 12px, tracking .14em, uppercase   state word, footnotes
```
Scale on a 390px phone: sentence 40/44 (auto-shrinks to 32 when >90 chars), name 20/24, button 20, label 12. Landing headline 64.
Wordmark is plain text: *One at a time* in display italic. No script image.

## Screens

### 1. Listener (`/`) — the page
```
┌──────────────────────────────┐
│ One at a time        ⚙       │  wordmark 18 italic · gear 24 ink-2
│ LISTENING                    │  label, ink-2
│                              │
│                              │
│ ● Dad                        │  name 20 bold + color dot
│ Sunday at one, everyone      │  sentence 40 italic ink
│ brings a side.               │
│                              │
│ THE TABLE LAUGHED            │  label, appears 6 s after a laugh, else empty line
│                              │
│                              │
│                              │
│      ( Say something )       │  pill button 64h, amber bg, ink text
│      What did I miss?        │  text link 17 ink-2, underline on focus
└──────────────────────────────┘
```
- The sentence area is vertically centered in the free space. Nothing scrolls.
- **Asked you**: the whole page background turns amber for 10 s; name line becomes "Mom asked you"; sentence is the question; three pill buttons appear under it: Yes · Clarify · Can't (cream bg, ink text). Then the page returns to cream.
- **What did I miss?**: the sentence area is replaced by ≤3 lines, each `Name: line`, in body 20, for 15 s; a label "SINCE YOU LOOKED AWAY · 40 S". Then back.
- **Say something** opens a bottom sheet on cream: three suggested lines as full-width pills (body 20), one text field, one button "Send to the table" (amber). Sending closes the sheet. No voice controls here; voice is a Settings toggle.
- Empty state (nobody spoke yet): sentence area shows *Nobody is talking yet.* in display italic ink-2.
- Settings sheet: name, also called, text size (S M L XL), language (EN IT TR), "Show captions", "The clerk speaks for me", "Notice when I look away", and at the bottom the join link with a QR under the label ADD PHONES. Plain rows, hairline rules. That is the only place with more than one thing.

### 2. Lamp (`/join.html`) — the hearing person's phone
Join form on cream: wordmark, one field "Your name", one amber pill "Put me on the table", one line in ink-2: *Your phone is your mic. It changes color when it's your turn to slow down.*
After joining, the screen is a single color with a single word:
```
┌──────────────────────────────┐
│ DAD                          │  label, cream on color
│                              │
│                              │
│        Go ahead              │  display italic 56, cream
│                              │
│                              │
│                              │
│ one at a time helps Bera     │  body 17 cream/80 (only on amber/red)
└──────────────────────────────┘
```
- `--go` "Go ahead" · `--amber` "One at a time" (overlap) · `--amber` "Slower" (fast) · `--stop` "Too fast".
- Say card: screen turns cream, label BERA SAYS, the sentence in display italic 36 ink, tap anywhere to dismiss; if audio is attached it plays; otherwise the browser voice speaks only if the table's voice is on.
- Tap anywhere: shows Mute / Leave for 8 s in the bottom corner, then hides.
- Screen stays awake. Vibrate on color change, max once per 10 s.

### 3. Landing (`/landing.html`)
Cream. Headline *One at a time.* at 64. One paragraph, body 22, max 34ch: *Every accessibility tool puts the burden on the deaf person. We built the other side. Everyone's phone goes on the table. When two people talk at once, their phones turn amber. The hard-of-hearing person reads one sentence at a time, and taps once to speak.* Two pills: "Open the listener" (amber) · "Put my phone on the table" (outline, ink). One line of three numbers in label style with hairline rules between: 50M IN THE EU REPORT TROUBLE HEARING · FAMILY TABLE IS THE #1 PLACE THEY WANT TO HEAR, 56% · ONLY 4% OF NON-SPEECH INFO REACHES CAPTIONS. Footer label: NOTHING IS STORED · ENGLISH ITALIAN TURKISH. No image.

### Desktop
The listener page centered at 640px on cream, same layout, sentence 56. Nothing else. The old table view stays unmounted.

## Motion
- Sentence change: old fades to 0 and new slides up 8px, 160 ms. Never reflow.
- Page color change (amber ask, lamp states): 200 ms background transition.
- Sheets: slide up 200 ms. Reduced motion: no movement, instant swaps.

## Accessibility
Ink on cream 15:1; cream on go 4.9:1, on amber 4.5:1 (use ink on amber for text ≤24px), on stop 6.2:1. Body ≥17, sentence ≥32. Targets ≥56px. `aria-live="polite"` on the sentence, `assertive` on the ask. Focus ring: 3px ink offset 2px. All controls reachable by keyboard.

## Don't
Icons. Cards. Shadows. Textures. Mascot. Counters. Badges. A second accent. A second font family in one screen. Anything the listener has to read while someone is talking that is not the sentence.

## Addendum: the second page (value without clutter)
The home stays one sentence. Below the text link sits a quiet label: `PLANS · 3` (count of open items; hidden at 0). Swipe up anywhere, or tap the label, to open **The table**: a cream page, same type, three plain sections separated by hairlines, no cards:
- **Plans** — each as `Sunday at one, everyone brings a side.` in body 20, with a second line in ink-2 `Mom · because nonna can't do evenings`. Pushback/questions/changes appear in the same list with a one-word label prefix in Space Mono (PUSHBACK, QUESTION, CHANGED).
- **Asked of you** — `Mom: are you coming Sunday?` with the same Yes · Clarify · Can't pills.
- **Since you looked away** — the last catch-up, ≤3 lines.
Swipe down or tap the wordmark to return. The page never appears on its own; the ask still takes over the home.
