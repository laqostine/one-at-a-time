// Builds pitch/I-Missed-That-BAINSA.pptx
// Run: python3 pitch/build/prep_assets.py && NODE_PATH=$(npm root -g) node pitch/build/build.js
const path = require('path');
const pptxgen = require('pptxgenjs');

const A = (f) => path.join(__dirname, 'assets', f);
const OUT = path.join(__dirname, '..', 'I-Missed-That-BAINSA.pptx');

const C = {
  bg: '171310', text: 'F1E9DD', muted: 'A89B8A', faint: '6F6457',
  card: '211B16', line: '3A3029', blue: '7FB4FF', amber: 'F1C76A',
};
const SERIF = 'Georgia';
const SANS = 'Arial';
const W = 13.333, M = 0.6;

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.title = 'I Missed That — BAINSA Hackathon 2026';

function base(notes) {
  const s = pptx.addSlide();
  s.background = { color: C.bg };
  if (notes) s.addNotes(notes);
  return s;
}
function overline(s, text, y = 0.45) {
  s.addText(text, { x: M, y, w: 8, h: 0.35, fontFace: SANS, fontSize: 13, color: C.muted,
    charSpacing: 4, bold: true, margin: 0 });
}
function headline(s, text, opts = {}) {
  s.addText(text, Object.assign({ x: M, y: 0.8, w: W - 2 * M, h: 1.0, fontFace: SERIF,
    fontSize: 40, color: C.text, margin: 0, valign: 'top' }, opts));
}
function icon(s, name, x, y, size) {
  s.addImage({ path: A(name + '.png'), x, y, w: size, h: size });
}
const sup = (n) => ({ text: String(n), options: { superscript: true, color: C.muted } });

// ---------- 1. Title ----------
{
  const s = base(
    'Roles: Presenter narrates and holds the phone/laptop. Alex, Sam, Priya play a family Sunday lunch — three teammates as relatives (each phone is its owner\'s mic).\n\n' +
    '"Transcription tells you what was said. We tell you what you missed."\n\n' +
    'If Deepgram or the camera acts up, say so and press A to switch to ?replay=demo2 — it reproduces the exact same cards deterministically.');
  icon(s, 'table', 7.55, 0.95, 5.3);
  icon(s, 'lamp', 10.9, 0.55, 1.5);
  s.addText('BAINSA HACKATHON 2026  ·  I MISSED THAT / SILENT SPECS', { x: M, y: 0.6, w: 9.5, h: 0.35,
    fontFace: SANS, fontSize: 13, bold: true, charSpacing: 3, color: C.muted, margin: 0 });
  s.addText('I Missed That', { x: M, y: 1.7, w: 7.4, h: 1.5, fontFace: SERIF, italic: true,
    fontSize: 76, color: C.text, margin: 0, valign: 'middle' });
  s.addText([
    { text: 'Transcription tells you what was said. ', options: { color: C.text } },
    { text: 'We tell you what you missed.', options: { color: C.blue } },
  ], { x: M, y: 3.45, w: 6.7, h: 1.4, fontFace: SERIF, fontSize: 28, margin: 0, valign: 'top' });
  s.addText('For hard-of-hearing and late-deafened adults, at their hearing family\'s table.',
    { x: M, y: 5.0, w: 6.6, h: 0.8, fontFace: SANS, fontSize: 20, color: C.muted, margin: 0, valign: 'top' });
  s.addText('Team: [Name] · [Name] · [Name] · [Name]', { x: M, y: 6.45, w: 7, h: 0.45,
    fontFace: SANS, fontSize: 18, color: C.text, margin: 0 });
}

// ---------- 2. The flip ----------
{
  const s = base(
    '0:00–0:15 — the flip (before any card is on screen)\n' +
    '"Every accessibility tool puts the whole burden on the deaf person. Read faster. Ask again. Get told never mind. We built the other side."\n\n' +
    '(A relative\'s phone is already visible on screen, lying on the table like a placemat. As the presenter says this line, two relatives start talking over each other — that phone goes amber. This happens before a single card appears. The burden flips first; the product shows up second.)');
  icon(s, 'plate', W - M - 1.3, 0.45, 1.3);
  headline(s, 'Every accessibility tool puts the whole burden on the deaf person.', { y: 0.55, w: 10.6, h: 1.45, fontSize: 40 });
  s.addText([
    { text: 'Read faster. Ask again. Get told never mind. ', options: { color: C.muted } },
    { text: 'We built the other side.', options: { color: C.blue, bold: true } },
  ], { x: M, y: 2.1, w: 11.5, h: 0.5, fontFace: SANS, fontSize: 22, margin: 0 });

  const quotes = [
    { w: 3.3, q: '“Dinner table syndrome and I want to cry.”', src: 'thread title, r/deaf, 174↑', size: 26 },
    { w: 5.1, q: '“DTS - Dinner Table Syndrome. Deaf people in hearing families are too familiar with this, myself included. It\'s simply too much work to follow along. Thats why you feel like you could sleep for a week, we have to work much harder than a hearing person to understand verbal conversations.”', src: 'r/deaf, “Exhausted and sad after family Sunday lunch,” 36↑', size: 19 },
    { w: 3.3, q: '“I\'d say the hardest part for me as a Deaf person in a hearing family during the holidays is extreme dinner table syndrome.”', src: 'r/deaf, “Christmas family diner experiences”', size: 20 },
  ];
  let x = M; const y = 2.95, h = 3.95, gap = 0.2;
  for (const q of quotes) {
    s.addShape(pptx.shapes.RECTANGLE, { x, y, w: q.w, h, fill: { color: C.card }, line: { color: C.line, width: 0.75 } });
    s.addText(q.q, { x: x + 0.25, y: y + 0.25, w: q.w - 0.5, h: h - 1.05, fontFace: SERIF, italic: true,
      fontSize: q.size, color: C.text, margin: 0, valign: 'top' });
    s.addText([{ text: '— ' + q.src, options: {} }, sup(7)], { x: x + 0.25, y: y + h - 0.7, w: q.w - 0.5, h: 0.5,
      fontFace: SANS, fontSize: 12, color: C.muted, margin: 0, valign: 'bottom' });
    x += q.w + gap;
  }
}

// ---------- 3. Numbers ----------
{
  const s = base(
    'Q10: Why family, and not work?\n' +
    'The numbers said so before we did: in the EuroTrak Italy survey, 56% of people with hearing loss say home with family is where hearing well matters most, against 21% for the workplace. And practically, a family will put their phones down for you in a way a client on a Zoom call never will. Work is the second scenario, not the first.\n\n' +
    '(Deck line: In the EU, about 50 million people say they have trouble hearing. Only about a third use hearing aids. And the place they most want to hear isn\'t the office — it\'s the family table. >90% of deaf children have hearing parents is US-sourced child data, say ">90%" and nothing stronger.)');
  overline(s, 'THE NUMBERS');
  // hero
  s.addText('50M', { x: M, y: 1.0, w: 4.4, h: 1.7, fontFace: SERIF, fontSize: 110, color: C.blue, margin: 0, valign: 'middle' });
  s.addText([{ text: 'people in the EU say they have trouble hearing. One in nine.' }, sup(1)],
    { x: M, y: 2.85, w: 4.1, h: 1.3, fontFace: SANS, fontSize: 22, color: C.text, margin: 0, valign: 'top' });
  s.addText([{ text: 'And the place they most want to hear isn\'t the office. It\'s the family table.' }],
    { x: M, y: 4.55, w: 4.0, h: 1.5, fontFace: SERIF, italic: true, fontSize: 22, color: C.muted, margin: 0, valign: 'top' });
  icon(s, 'mug', M - 0.1, 5.95, 1.15);

  const tiles = [
    ['~1/3', 'of them use hearing aids', 1],
    ['56%', 'say the family table matters most. Work: 21%.', 2],
    ['51.9%', 'of DHH live-caption users are frustrated with them', 3],
    ['170 wpm', 'caption comprehension drops. Group talk runs 160–220.', 3],
    ['4%', 'of videos caption non-speech sound: laughter, tone', 4],
    ['>90%', 'of deaf children have hearing parents', 5],
  ];
  const gx = 5.2, gy = 1.0, tw = 2.4, th = 2.85, gap = 0.2;
  tiles.forEach(([n, label, cite], i) => {
    const x = gx + (i % 3) * (tw + gap), y = gy + Math.floor(i / 3) * (th + gap);
    s.addShape(pptx.shapes.RECTANGLE, { x, y, w: tw, h: th, fill: { color: C.card }, line: { color: C.line, width: 0.75 } });
    s.addText(n, { x: x + 0.2, y: y + 0.2, w: tw - 0.3, h: 0.85, fontFace: SERIF, fontSize: n.length > 5 ? 34 : 44,
      color: C.text, margin: 0, valign: 'middle', fit: 'none' });
    s.addText([{ text: label }, sup(cite)], { x: x + 0.2, y: y + 1.15, w: tw - 0.4, h: th - 1.3,
      fontFace: SANS, fontSize: 18, color: C.text, margin: 0, valign: 'top' });
  });
  s.addText('Sources on the last slide. ¹ EU27 figure derived from the 59M Europe (EU+UK+NO+CH) total. ⁵ US data, children.',
    { x: gx, y: 6.93, w: 7.6, h: 0.4, fontFace: SANS, fontSize: 11, color: C.faint, margin: 0 });
}

// ---------- 4. The contract ----------
{
  const s = base(
    'Accessibility at a table is a contract between everyone present. We\'re the clerk that holds both sides to it — Claude is the clerk any family or team can hire; the contract and the evidence are ours.\n\n' +
    'Q2: Doesn\'t the crosstalk lamp shame the fast talker, or the loud aunt?\n' +
    'It goes amber, never red, and it\'s ambient light on the table\'s own phones — a mirror, not a scolding. Nobody has to be the one saying "one at a time" for the hundredth time; the lamp says it instead.\n\n' +
    'Q1: What if the AI says something I didn\'t mean?\n' +
    'It never speaks anything you haven\'t picked and can edit first. Say-it-as-text queues candidate lines from what\'s actually being said; you tap the one you want, you can edit it, and only then does it appear on the table\'s phones. It\'s autocomplete for the moment you\'re locked out of, not autopilot.');
  overline(s, 'THE CONTRACT');
  headline(s, 'A table is a contract. We hold both sides to it.', { y: 0.8, h: 0.8, fontSize: 40 });

  const row = (x, y, w, ic, title, desc, color) => {
    icon(s, ic, x, y, 0.85);
    s.addText(title, { x: x + 0.97, y: y + 0.02, w: w - 0.97, h: 0.42, fontFace: SANS, fontSize: 19, bold: true, color: color || C.text, margin: 0, valign: 'top' });
    s.addText(desc, { x: x + 0.97, y: y + 0.45, w: w - 0.97, h: 0.75, fontFace: SANS, fontSize: 15, color: C.muted, margin: 0, valign: 'top' });
  };
  // left column
  const lx = M, lw = 3.95, top = 2.55, rh = 1.45;
  s.addText('THE TABLE\'S SIDE', { x: lx, y: 2.1, w: lw, h: 0.3, fontFace: SANS, fontSize: 13, bold: true, charSpacing: 3, color: C.muted, margin: 0 });
  row(lx, top, lw, 'phone', 'Phones as mics', 'QR join, no install. Each voice arrives named.');
  row(lx, top + rh, lw, 'lamp', 'Crosstalk lamp', 'Glows amber when two people talk at once.');
  row(lx, top + 2 * rh, lw, 'hand', 'One at a time', 'A gentle nudge when the talk keeps flapping.');
  // divider
  s.addShape(pptx.shapes.LINE, { x: 4.85, y: 2.15, w: 0, h: 4.75, line: { color: C.line, width: 1 } });
  // right column (2 x 3)
  const rx = 5.15, cw = 3.7;
  s.addText('YOUR SIDE', { x: rx, y: 2.1, w: 6, h: 0.3, fontFace: SANS, fontSize: 13, bold: true, charSpacing: 3, color: C.blue, margin: 0 });
  const mine = [
    ['note', 'Plans, with why', 'Sunday at nonna\'s: who brings what, and why.'],
    ['bell', 'Asked you', 'The moment someone asks you, with a buzz.', C.amber],
    ['popper', 'Why they laughed', 'The joke itself, so you can laugh for real.'],
    ['mug', 'Look-away catch-up', 'Look back up and the card opens itself.'],
    ['card', 'Say it as text', 'One tap, shown on every phone at the table.'],
    ['eraser', 'Doubt words', 'Unsure words dimmed. Tap to ask again.'],
  ];
  mine.forEach(([ic, t, d, col], i) => row(rx + (i % 2) * (cw + 0.2), top + Math.floor(i / 2) * rh, cw, ic, t, d, col));
}

// ---------- 5. Live demo ----------
{
  const s = base(
    '0:15–0:35 — phones on the table, plans form\n' +
    'Alex: "So are we doing Sunday at nonna\'s again?"  Sam: "I can bring the dessert if someone else does the pasta."  Priya: "I\'ll do the pasta, but not before 2."\n' +
    '(A Plans card fills live: "Sunday at nonna\'s — Sam: dessert, Priya: pasta (after 2)," each with the reason attached.)\n\n' +
    '0:35 — the joke. Someone tells a joke; the table laughs. A "Why they laughed" card appears: the last ~12 seconds, so the presenter gets the joke, not just the laughter.\n\n' +
    '0:45 — looking away. Presenter looks down at their phone; a pill reads "Away." Presenter looks up; a card opens by itself: "While you looked away: Sam changed dessert to tiramisu."\n\n' +
    '0:55 — asked you. Alex: "Bera, are you coming Sunday?" Phone buzzes. An "Asked you" card pulses.\n\n' +
    '1:05 — speak for me. Presenter taps a queued line — "yes, I\'ll bring wine" — and it appears as text on everyone\'s phone at the table. "I didn\'t have to shout over the table. It just showed up where everyone was already looking."\n\n' +
    'Close: "Not a transcript. The plan, the joke, the question aimed at you, and a way back in. Ava does the mics. We do what the mics are for."\n\n' +
    'Fallback: press A for ?replay=demo2.');
  overline(s, 'LIVE DEMO  ·  90 SECONDS');
  const ih = 4.35, iw = ih * 1280 / 900;
  s.addShape(pptx.shapes.RECTANGLE, { x: M - 0.04, y: 0.95 - 0.04, w: iw + 0.08, h: ih + 0.08, fill: { color: C.line }, line: { color: C.line } });
  s.addImage({ path: A('table-app.png'), x: M, y: 0.95, w: iw, h: ih });
  const tx = M + iw + 0.45, tw = W - M - tx;
  s.addText('A family Sunday lunch. Three phones, one clerk.', { x: tx, y: 0.95, w: tw, h: 1.3, fontFace: SERIF, fontSize: 30, color: C.text, margin: 0, valign: 'top' });
  s.addText('Not a transcript. The plan, the joke, the question aimed at you, and a way back in.',
    { x: tx, y: 2.55, w: tw, h: 1.7, fontFace: SERIF, italic: true, fontSize: 21, color: C.muted, margin: 0, valign: 'top' });
  s.addText('Backup: ?replay=demo2 replays the same cards, no mic needed.', { x: tx, y: 4.45, w: tw, h: 0.8, fontFace: SANS, fontSize: 14, color: C.faint, margin: 0, valign: 'top' });

  // timeline strip
  const beats = [
    ['0:00', 'The flip', 'hand'], ['0:15', 'Plans form', 'note'], ['0:35', 'Why they laughed', 'popper'],
    ['0:45', 'Look-away', 'mug'], ['0:55', 'Asked you', 'bell', C.amber], ['1:05', 'Speak for me', 'card'],
  ];
  const ty = 5.75, sw = (W - 2 * M) / beats.length;
  s.addShape(pptx.shapes.LINE, { x: M + 0.3, y: ty, w: W - 2 * M - 0.6, h: 0, line: { color: C.line, width: 1.5 } });
  beats.forEach(([t, label, ic, col], i) => {
    const x = M + i * sw;
    s.addShape(pptx.shapes.OVAL, { x: x + 0.22, y: ty - 0.08, w: 0.16, h: 0.16, fill: { color: col || C.blue }, line: { color: col || C.blue } });
    icon(s, ic, x + 0.05, ty + 0.2, 0.62);
    s.addText(t, { x: x + 0.75, y: ty + 0.33, w: 1.0, h: 0.35, fontFace: SANS, fontSize: 16, bold: true, color: col || C.blue, margin: 0 });
    s.addText(label, { x: x + 0.1, y: ty + 0.9, w: sw - 0.15, h: 0.65, fontFace: SANS, fontSize: 17, color: C.text, margin: 0, valign: 'top' });
  });
}

// ---------- 6. What's new ----------
{
  const s = base(
    'Q8: Why not just use Ava or Otter?\n' +
    'Ava gets you named, colored mics from every phone — genuinely good infrastructure, and we don\'t pretend to compete on it. Otter and Teams\' "catch me up" give you a transcript or a summary after the fact, built for a meeting room. Neither one has ever heard of a plan forming, a joke landing, or a question aimed at you by name. Ava does the mics. We do what the mics are for.');
  overline(s, 'WHAT\'S NEW');
  headline(s, [
    { text: 'Ava does the mics. ', options: { color: C.text } },
    { text: 'We do what the mics are for.', options: { color: C.blue } },
  ], { y: 0.8, h: 0.8, fontSize: 40 });
  const H = (t) => ({ text: t, options: { bold: true, fontSize: 13, color: C.muted, charSpacing: 2, fill: { color: C.bg } } });
  const cell = (t, o = {}) => ({ text: t, options: Object.assign({ fill: { color: C.card } }, o) });
  const rows = [
    [H('TOOL'), H('ALREADY DOES'), H('DOESN\'T DO')],
    [cell('Ava', { bold: true }), cell('Phones join as named mics, speaker colours, type-to-speak'), cell('No plans, no “asked you,” no “why they laughed.”')],
    [cell('Otter / Teams “Catch me up”', { bold: true }), cell('A summary after the fact, or on demand'), cell('Built for a meeting room, not a dinner table')],
    [cell('MS Teams captions', { bold: true }), cell('Live captions, logged-in speaker names'), cell('Breaks on overlap. Nothing addressed to you.')],
    [cell('Caption glasses (XRAI, Captify, AirCaps)', { bold: true }), cell('Captions in your line of sight'), cell('Arms clash with hearing aids. Still just words.')],
    [cell('I Missed That', { bold: true, color: C.blue, fill: { color: '1E2530' } }), cell('Phones as mics, like Ava', { fill: { color: '1E2530' } }),
      cell('Plans with why · asked you · why they laughed · look-away catch-up · say it as text', { color: C.blue, fill: { color: '1E2530' } })],
  ];
  s.addTable(rows, { x: M, y: 1.95, w: W - 2 * M, colW: [3.0, 4.2, 4.93], fontFace: SANS, fontSize: 17, color: C.text,
    border: { type: 'solid', pt: 1, color: C.bg }, margin: [0.1, 0.15, 0.1, 0.15], valign: 'middle',
    rowH: [0.4, 0.85, 0.85, 0.85, 0.85, 0.95] });
  s.addText('Sources: research/06-github-landscape.md, research/04-final-synthesis.md', { x: M, y: 7.0, w: 8, h: 0.3, fontFace: SANS, fontSize: 11, color: C.faint, margin: 0 });
}

// ---------- 7. How it works ----------
{
  const s = base(
    'Q7: Other languages? It works in English, Italian and Turkish end to end, verified on Deepgram\'s nova-3 streaming model. Family tables code-switch — nonna in dialect, kids in English — so lines are labeled per language, not forced into one.\n\n' +
    'Q5: Bystander privacy? Nothing is stored after the session — in-memory ring buffer only, gone on refresh or close. There\'s an always-visible listening indicator and a pause button.\n\n' +
    'Q9: If Deepgram or Claude is down mid-demo? ?replay= needs neither key nor a mic and reproduces the exact same cards deterministically. Short of that, it degrades to the browser\'s Web Speech API: you keep live captions, you lose the plans/asked-you/why-they-laughed extraction until the connection\'s back. Neither is a crash.');
  overline(s, 'HOW IT WORKS');
  headline(s, 'From the table to a card, in seconds.', { y: 0.8, h: 0.8 });
  const boxes = [
    { w: 2.45, t: 'Phones on the table', d: 'One mic per person, joined by QR', ic: 'phone' },
    { w: 2.65, t: 'Deepgram nova-3', d: 'Streaming ASR per phone. English, Italian, Turkish.' },
    { w: 2.45, t: 'Browser ledger', d: 'Who said what, when. Lives in memory.' },
    { w: 3.35, t: 'Claude, structured calls', d: 'gate 0.7 s · ledger 4–6 s · catch-up 4 s. Returns fields, never prose.', accent: true },
  ];
  const by = 2.1, bh = 2.3, gap = 0.37;
  let x = M; const pos = [];
  boxes.forEach((b, i) => {
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x, y: by, w: b.w, h: bh, rectRadius: 0.12, fill: { color: C.card }, line: { color: b.accent ? C.blue : C.line, width: 1.25 } });
    s.addText(b.t, { x: x + 0.22, y: by + 0.22, w: b.w - 0.4, h: 0.8, fontFace: SANS, fontSize: 20, bold: true, color: b.accent ? C.blue : C.text, margin: 0, valign: 'top' });
    s.addText(b.d, { x: x + 0.22, y: by + 1.05, w: b.w - 0.4, h: 1.15, fontFace: SANS, fontSize: 15, color: C.muted, margin: 0, valign: 'top' });
    pos.push({ x, w: b.w });
    if (i < boxes.length - 1) s.addShape(pptx.shapes.LINE, { x: x + b.w + 0.05, y: by + bh / 2, w: gap - 0.1, h: 0, line: { color: C.blue, width: 2, endArrowType: 'triangle' } });
    x += b.w + gap;
  });
  // camera box under ledger, arrow up
  const L = pos[2];
  const cy = 5.15;
  s.addShape(pptx.shapes.LINE, { x: L.x + L.w / 2, y: cy, w: 0, h: -(cy - by - bh) + 0.05, line: { color: C.blue, width: 2, endArrowType: 'triangle' }, flipV: true });
  s.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: pos[0].x, y: cy, w: pos[2].x + pos[2].w - pos[0].x, h: 1.05, rectRadius: 0.12, fill: { color: C.card }, line: { color: C.line, width: 1.25 } });
  s.addText([
    { text: 'On-device camera  ', options: { bold: true, color: C.text } },
    { text: 'sends only “away” / “back.” No video leaves the phone.', options: { color: C.muted } },
  ], { x: pos[0].x + 0.22, y: cy, w: pos[2].x + pos[2].w - pos[0].x - 0.4, h: 1.05, fontFace: SANS, fontSize: 18, margin: 0, valign: 'middle' });
  // output cards under Claude
  const Cc = pos[3];
  s.addShape(pptx.shapes.LINE, { x: Cc.x + Cc.w / 2, y: by + bh + 0.05, w: 0, h: cy - by - bh - 0.1, line: { color: C.blue, width: 2, endArrowType: 'triangle' } });
  ['note', 'bell', 'popper', 'mug', 'card'].forEach((ic, i) => icon(s, ic, Cc.x + 0.02 + i * 0.66, cy + 0.05, 0.62));
  s.addText('the cards', { x: Cc.x, y: cy + 0.7, w: Cc.w, h: 0.35, fontFace: SANS, fontSize: 14, color: C.muted, margin: 0, align: 'center' });
  s.addText([
    { text: 'Nothing stored. ', options: { bold: true, color: C.text } },
    { text: 'In memory only, gone when the session closes.', options: { color: C.muted } },
  ], { x: M, y: 6.6, w: W - 2 * M, h: 0.45, fontFace: SANS, fontSize: 20, margin: 0 });
}

// ---------- 8. Scope, limits, next + Sources ----------
{
  const s = base(
    'Q3: Why not build for sign-first Deaf users?\n' +
    'Scoped out on purpose. Sign-first Deaf users are often better served by an interpreter or a full visual language — that\'s a different, well-served problem. We target the group in between: hard-of-hearing and late-deafened adults who rely on spoken language in rooms full of hearing people, where nobody brings an interpreter to Sunday lunch.\n\n' +
    'Q6: Cards on a phone at dinner — isn\'t that just more screens? One card at a time, no scrolling wall; they let you look up sooner, not later. A shared screen in the middle of the table (table mode) is on the roadmap for relatives who won\'t read a phone.\n\n' +
    'Close: "Not a transcript. The plan, the joke, the question aimed at you, and a way back in. Ava does the mics. We do what the mics are for."');
  overline(s, 'SCOPE, LIMITS, NEXT');
  headline(s, 'What this is, and isn\'t.', { y: 0.8, w: 6.6, h: 0.8 });
  const items = [
    ['Built for', 'hard-of-hearing and late-deafened adults at a hearing family\'s table.'],
    ['Not for', 'sign-first Deaf users.'],
    ['Tested', 'not yet with a hard-of-hearing user.'],
    ['Reach', '~10M in the EU could use it. Tonight it reaches tens.'],
    ['Next', 'HoH user tests, a table mode for 65+, glasses as a display.'],
  ];
  let y = 1.85;
  items.forEach(([k, v]) => {
    s.addText(k.toUpperCase(), { x: M, y: y + 0.04, w: 1.55, h: 0.35, fontFace: SANS, fontSize: 13, bold: true, charSpacing: 2, color: k === 'Next' ? C.blue : C.muted, margin: 0, valign: 'top' });
    s.addText(v, { x: M + 1.6, y, w: 5.0, h: 0.85, fontFace: SANS, fontSize: 20, color: C.text, margin: 0, valign: 'top' });
    y += 0.98;
  });
  icon(s, 'chair', M, 6.55, 0.75);
  // sources panel
  const sx = 7.55, sw = W - M - sx;
  s.addShape(pptx.shapes.RECTANGLE, { x: sx - 0.25, y: 0.45, w: sw + 0.45, h: 6.65, fill: { color: C.card }, line: { color: C.line, width: 0.75 } });
  s.addText('SOURCES', { x: sx, y: 0.65, w: sw, h: 0.3, fontFace: SANS, fontSize: 13, bold: true, charSpacing: 3, color: C.muted, margin: 0 });
  const src = [
    ['AEA / EFHOH / EHIMA (EuroTrak), Getting the numbers right on hearing loss in Europe, 2024', 'https://www.ehima.com/wp-content/uploads/2024/03/Getting-the-numbers-right-on-Hearing-Loss-Hearing-Care-and-Hearing-Aid-Use-in-Europe-2024.pdf'],
    ['EHIMA / Anovum, EuroTrak Italy 2022', 'https://www.ehima.com/wp-content/uploads/2022/11/EuroTrak_Italy_2022.pdf'],
    ['Live-caption quality and reading-speed metrics (51.9%, 170 wpm), via NotebookLM synthesis, research/05', null],
    ['Non-speech information in captions, EEG study, PMC7040021; May et al. 2025', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7040021/'],
    ['Mitchell & Karchmer 2004, Sign Language Studies 4(2), US data', 'https://eric.ed.gov/?id=EJ747626'],
    ['Meek 2020, Dinner Table Syndrome, The Qualitative Report 25(6)', 'https://nsuworks.nova.edu/tqr/vol25/iss6/16/'],
    ['r/deaf and r/hardofhearing threads', 'https://www.reddit.com/r/deaf/comments/n8msyg/\nhttps://www.reddit.com/r/deaf/comments/1fh8h7h/\nhttps://www.reddit.com/r/deaf/comments/1pqqqbs/\nhttps://www.reddit.com/r/hardofhearing/comments/1tmpx4t/'],
  ];
  const runs = [];
  src.forEach(([t, u], i) => {
    runs.push({ text: `${i + 1}  ${t}`, options: { color: C.text, breakLine: true, paraSpaceAfter: u ? 0 : 7 } });
    if (u) u.split('\n').forEach((uu, j, arr) => runs.push({ text: uu, options: { color: C.blue, fontSize: 10.5, breakLine: true,
      paraSpaceAfter: j === arr.length - 1 ? 8 : 0, hyperlink: { url: uu } } }));
  });
  s.addText(runs, { x: sx, y: 1.05, w: sw, h: 5.9, fontFace: SANS, fontSize: 13, margin: 0, valign: 'top' });
}

pptx.writeFile({ fileName: OUT }).then((f) => console.log('wrote', f));
