// Builds pitch/I-Missed-That-BAINSA.pptx
// Typographic only — no illustrated icons.
// Run: NODE_PATH=$(npm root -g) node pitch/build/build.js
const path = require('path');
const pptxgen = require('pptxgenjs');

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
pptx.title = 'One at a time — BAINSA Hackathon 2026';

function base(notes) {
  const s = pptx.addSlide();
  s.background = { color: C.bg };
  if (notes) s.addNotes(notes);
  return s;
}
function overline(s, text, y = 0.45) {
  s.addText(text, { x: M, y, w: 10, h: 0.35, fontFace: SANS, fontSize: 13, color: C.muted,
    charSpacing: 4, bold: true, margin: 0 });
}
function headline(s, text, opts = {}) {
  s.addText(text, Object.assign({ x: M, y: 0.8, w: W - 2 * M, h: 1.0, fontFace: SERIF,
    fontSize: 40, color: C.text, margin: 0, valign: 'top' }, opts));
}
const sup = (n) => ({ text: String(n), options: { superscript: true, color: C.muted } });

// ---------- 1. Title ----------
{
  const s = base(
    'Roles: Presenter narrates. Two teammates play a table of hearing people; a judge holds the listener phone. Each phone is its owner\'s mic.\n\n' +
    'Fallback: if Deepgram acts up, switch to ?replay=demo2 — it reproduces the exact same cards deterministically.');
  s.addText('BAINSA HACKATHON 2026', { x: M, y: 0.6, w: 9.5, h: 0.35,
    fontFace: SANS, fontSize: 13, bold: true, charSpacing: 3, color: C.muted, margin: 0 });
  s.addText('One at a time.', { x: M, y: 2.2, w: 11.5, h: 2.0, fontFace: SERIF, italic: true,
    fontSize: 96, color: C.text, margin: 0, valign: 'middle' });
  s.addText('The first accessibility tool for the hearing side of the table.',
    { x: M, y: 4.55, w: 10.5, h: 0.8, fontFace: SERIF, fontSize: 26, color: C.blue, margin: 0, valign: 'top' });
  s.addShape(pptx.shapes.LINE, { x: M, y: 6.55, w: 2.4, h: 0, line: { color: C.line, width: 1 } });
  s.addText('Team: [Name] · [Name] · [Name] · [Name]', { x: M, y: 6.7, w: 8, h: 0.45,
    fontFace: SANS, fontSize: 16, color: C.muted, margin: 0 });
}

// ---------- 2. The flip ----------
{
  const s = base(
    '"Every accessibility tool puts the burden on the deaf person. We built the other side. Hold this."\n\n' +
    'Q1: Who\'s speaking for me — what if it says something I didn\'t mean?\n' +
    'You pick the line and can edit it before it sends. It\'s autocomplete for the moment you\'re locked out of, not autopilot.');
  overline(s, 'THE FLIP');
  headline(s, 'Every accessibility tool puts the burden on the deaf person.', { y: 0.9, w: 11.5, h: 1.5, fontSize: 38 });
  s.addText([
    { text: 'Read faster. Ask again. Get told never mind. ', options: { color: C.muted } },
    { text: 'We built the other side.', options: { color: C.blue, bold: true } },
  ], { x: M, y: 2.25, w: 11.5, h: 0.55, fontFace: SANS, fontSize: 24, margin: 0 });

  const quotes = [
    { q: '"I\'ve started just nodding along even when I have no idea what was decided. My boss mentioned something about a new client project last Thursday and I smiled and agreed but I genuinely don\'t know what I signed up for."', src: 'r/deaf, 35↑', size: 22 },
    { q: '"DTS - Dinner Table Syndrome. Deaf people in hearing families are too familiar with this, myself included. It\'s simply too much work to follow along. Thats why you feel like you could sleep for a week, we have to work much harder than a hearing person to understand verbal conversations."', src: 'r/deaf, 36↑', size: 22 },
  ];
  const qw = 5.65, qh = 4.0, qy = 3.05, gap = 0.35;
  quotes.forEach((qq, i) => {
    const x = M + i * (qw + gap);
    s.addShape(pptx.shapes.RECTANGLE, { x, y: qy, w: qw, h: qh, fill: { color: C.card }, line: { color: C.line, width: 0.75 } });
    s.addText(qq.q, { x: x + 0.3, y: qy + 0.3, w: qw - 0.6, h: qh - 1.0, fontFace: SERIF, italic: true,
      fontSize: qq.size, color: C.text, margin: 0, valign: 'top' });
    s.addText('— ' + qq.src, { x: x + 0.3, y: qy + qh - 0.6, w: qw - 0.6, h: 0.4,
      fontFace: SANS, fontSize: 13, color: C.muted, margin: 0, valign: 'bottom' });
  });
}

// ---------- 3. Numbers ----------
{
  const s = base(
    'Q10: Why family, and not work?\n' +
    'The numbers said so first: 56% say home with family is where hearing well matters most, against 21% for work. And a family will put their phones down for you in a way a client on a call never will.');
  overline(s, 'THE NUMBERS');
  s.addText('50M', { x: M, y: 1.0, w: 4.4, h: 1.7, fontFace: SERIF, fontSize: 110, color: C.blue, margin: 0, valign: 'middle' });
  s.addText([{ text: 'people in the EU say they have trouble hearing. About one in nine.' }, sup(1)],
    { x: M, y: 2.85, w: 4.2, h: 1.3, fontFace: SANS, fontSize: 22, color: C.text, margin: 0, valign: 'top' });
  s.addText('Hard-of-hearing and late-deafened adults.',
    { x: M, y: 5.9, w: 4.0, h: 0.8, fontFace: SERIF, italic: true, fontSize: 19, color: C.muted, margin: 0, valign: 'top' });

  const tiles = [
    ['56% vs 21%', 'say the family table matters most for hearing well. Work: 21%.', 2],
    ['170 wpm', 'caption comprehension drops. Group speech runs 160–220.', 3],
    ['4%', 'of sampled videos caption non-speech sound (laughter, tone)', 3],
  ];
  const gx = 5.2, gy = 1.4, tw = 2.55, th = 3.1, gap = 0.2;
  tiles.forEach(([n, label, cite], i) => {
    const x = gx + i * (tw + gap), y = gy;
    s.addShape(pptx.shapes.RECTANGLE, { x, y, w: tw, h: th, fill: { color: C.card }, line: { color: C.line, width: 0.75 } });
    s.addText(n, { x: x + 0.22, y: y + 0.25, w: tw - 0.4, h: 1.0, fontFace: SERIF, fontSize: n.length > 6 ? 30 : 40,
      color: C.text, margin: 0, valign: 'middle', fit: 'none' });
    s.addText([{ text: label }, sup(cite)], { x: x + 0.22, y: y + 1.35, w: tw - 0.44, h: th - 1.55,
      fontFace: SANS, fontSize: 17, color: C.text, margin: 0, valign: 'top' });
  });
  s.addText('Sources on the last slide. ¹ EU27 figure derived from the 59M Europe (EU+UK+NO+CH) total. ² EuroTrak Italy 2022. ³ from research synthesis.',
    { x: gx, y: 6.75, w: 7.6, h: 0.5, fontFace: SANS, fontSize: 11, color: C.faint, margin: 0 });
}

// ---------- 4. How it works ----------
{
  const s = base(
    'Sentence under 1 second. Lamp under 2 seconds. Nothing is stored.\n\n' +
    'Q9: What if Deepgram is down mid-demo? ?replay= needs neither key nor mic and reproduces the exact same cards deterministically.');
  overline(s, 'HOW IT WORKS');
  headline(s, 'One diagram.', { y: 0.8, h: 0.7 });

  const row1 = [
    { w: 2.75, t: 'Phones on the table', d: 'Each phone is its owner\'s mic.' },
    { w: 3.0, t: 'Deepgram', d: 'One streaming ASR connection per phone.' },
    { w: 3.05, t: 'The server', d: 'Measures pace and overlap, live.', accent: true },
  ];
  const by = 1.95, bh = 1.75, gap = 0.35;
  let x = M;
  const rowPos = [];
  row1.forEach((b, i) => {
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x, y: by, w: b.w, h: bh, rectRadius: 0.12, fill: { color: C.card }, line: { color: b.accent ? C.blue : C.line, width: 1.25 } });
    s.addText(b.t, { x: x + 0.22, y: by + 0.2, w: b.w - 0.4, h: 0.6, fontFace: SANS, fontSize: 19, bold: true, color: b.accent ? C.blue : C.text, margin: 0, valign: 'top' });
    s.addText(b.d, { x: x + 0.22, y: by + 0.85, w: b.w - 0.4, h: 1.0, fontFace: SANS, fontSize: 14, color: C.muted, margin: 0, valign: 'top' });
    rowPos.push({ x, w: b.w });
    if (i < row1.length - 1) s.addShape(pptx.shapes.LINE, { x: x + b.w + 0.05, y: by + bh / 2, w: gap - 0.1, h: 0, line: { color: C.blue, width: 2, endArrowType: 'triangle' } });
    x += b.w + gap;
  });

  // fan out to two outcome boxes
  const midX = rowPos[2].x + rowPos[2].w / 2;
  const oy = by + bh + 0.5;
  const outBh = 1.3;
  const outs = [
    { x: 5.0, w: 3.5, t: 'Amber', d: 'On the talkers\' own phones, when two overlap.' },
    { x: 8.85, w: 4.0, t: 'One sentence, with a name', d: 'On the listener\'s phone — nothing else.', accent: true },
  ];
  outs.forEach((o) => {
    s.addShape(pptx.shapes.LINE, { x: midX, y: by + bh + 0.05, w: (o.x + o.w / 2) - midX, h: oy - (by + bh + 0.05), line: { color: C.blue, width: 1.5, endArrowType: 'triangle' } });
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: o.x, y: oy, w: o.w, h: outBh, rectRadius: 0.12, fill: { color: C.card }, line: { color: o.accent ? C.blue : C.amber, width: 1.25 } });
    s.addText(o.t, { x: o.x + 0.22, y: oy + 0.15, w: o.w - 0.4, h: 0.45, fontFace: SANS, fontSize: 17, bold: true, color: o.accent ? C.blue : C.amber, margin: 0, valign: 'top' });
    s.addText(o.d, { x: o.x + 0.22, y: oy + 0.58, w: o.w - 0.4, h: 0.65, fontFace: SANS, fontSize: 13, color: C.muted, margin: 0, valign: 'top' });
  });

  // one tap -> text on every phone
  const ty = oy + outBh + 0.4;
  const tapBh = 0.75;
  s.addShape(pptx.shapes.LINE, { x: 8.85 + 4.0 / 2, y: oy + outBh + 0.05, w: 0, h: ty - (oy + outBh + 0.05) - 0.03, line: { color: C.blue, width: 1.5, endArrowType: 'triangle' } });
  s.addShape(pptx.shapes.ROUNDED_RECTANGLE, { x: M, y: ty, w: W - 2 * M, h: tapBh, rectRadius: 0.12, fill: { color: '1E2530' }, line: { color: C.blue, width: 1.25 } });
  s.addText([
    { text: 'One tap  ', options: { bold: true, color: C.blue } },
    { text: '→  text appears on every phone at the table.', options: { color: C.text } },
  ], { x: M + 0.25, y: ty, w: W - 2 * M - 0.5, h: tapBh, fontFace: SANS, fontSize: 19, margin: 0, valign: 'middle' });

  s.addText([
    { text: 'Sentence under 1 second. Lamp under 2 seconds. ', options: { color: C.text, bold: true } },
    { text: 'Nothing is stored.', options: { color: C.muted } },
  ], { x: M, y: ty + tapBh + 0.15, w: W - 2 * M, h: 0.4, fontFace: SANS, fontSize: 16, margin: 0 });
}

// ---------- 5. What's new ----------
{
  const s = base(
    'Q8: Why not just use Ava or Otter?\n' +
    'Ava gets you named mics from every phone — genuinely good, and we don\'t compete on it. Otter and Zoom summarize after the fact. Neither one has ever turned around and told the people talking to slow down.');
  overline(s, 'WHAT\'S NEW');
  headline(s, [
    { text: 'Ava does the mics. ', options: { color: C.text } },
    { text: 'We do the other side of the table.', options: { color: C.blue } },
  ], { y: 0.8, h: 0.9, fontSize: 36 });

  const H = (t) => ({ text: t, options: { bold: true, fontSize: 13, color: C.muted, charSpacing: 2, fill: { color: C.bg } } });
  const cell = (t, o = {}) => ({ text: t, options: Object.assign({ fill: { color: C.card } }, o) });
  const rows = [
    [H('TOOL'), H('ALREADY DOES'), H('DOESN\'T DO')],
    [cell('Ava', { bold: true }), cell('Phones join as named mics for captions'), cell('Never sends pace or overlap back to the speakers\' own phones.')],
    [cell('Otter / Zoom', { bold: true }), cell('Summarizes the conversation'), cell('Only after it\'s over — no live signal to anyone at the table.')],
    [cell('Caption glasses', { bold: true }), cell('Captions in the deaf person\'s line of sight'), cell('Still just words for one person. Nothing the table can act on.')],
    [cell('One at a time', { bold: true, color: C.blue, fill: { color: '1E2530' } }), cell('Phones as mics, like Ava', { fill: { color: '1E2530' } }),
      cell('Amber on the talkers\' phones. One sentence, one tap, on every phone.', { color: C.blue, fill: { color: '1E2530' } })],
  ];
  s.addTable(rows, { x: M, y: 2.1, w: W - 2 * M, colW: [2.6, 4.4, 5.13], fontFace: SANS, fontSize: 17, color: C.text,
    border: { type: 'solid', pt: 1, color: C.bg }, margin: [0.15, 0.18, 0.15, 0.18], valign: 'middle',
    rowH: [0.4, 1.05, 1.05, 1.05, 1.15] });
  s.addText('Sources: research/06-github-landscape.md, research/07-reddit-wishlist-analysis.md', { x: M, y: 7.0, w: 9, h: 0.3, fontFace: SANS, fontSize: 11, color: C.faint, margin: 0 });
}

// ---------- 6. Scope, limits, next + Sources ----------
{
  const s = base(
    'Q3: Why not build for sign-first Deaf users?\n' +
    'Scoped out on purpose. Sign-first Deaf users are often better served by an interpreter or a full visual language — a different, well-served problem. We target hard-of-hearing and late-deafened adults in rooms full of hearing people.\n\n' +
    'Q11: Where did the ledger go? It\'s there — second layer, ask me to show it.\n\n' +
    'Close: "One sentence. One word on their phones. One tap. Ava does the mics. We do the other side of the table."');
  overline(s, 'SCOPE, LIMITS, NEXT');
  headline(s, 'What this is, and isn\'t.', { y: 0.8, w: 6.6, h: 0.8 });
  const items = [
    ['Built for', 'hard-of-hearing and late-deafened adults, in hearing rooms.'],
    ['Not for', 'sign-first Deaf users.'],
    ['Tested', 'not yet with a hard-of-hearing user.'],
    ['Reach', '~10M in the EU could use it. Tonight it reaches a table.'],
    ['Next', 'HoH user tests. The plans ledger and look-away catch-up are already built as the second layer — ask to see them. Italian and Turkish verified.'],
  ];
  let y = 1.85;
  items.forEach(([k, v]) => {
    s.addText(k.toUpperCase(), { x: M, y: y + 0.04, w: 1.55, h: 0.35, fontFace: SANS, fontSize: 13, bold: true, charSpacing: 2, color: k === 'Next' ? C.blue : C.muted, margin: 0, valign: 'top' });
    s.addText(v, { x: M + 1.6, y, w: 5.0, h: 1.3, fontFace: SANS, fontSize: 18, color: C.text, margin: 0, valign: 'top' });
    y += k === 'Next' ? 1.5 : 0.95;
  });

  // sources panel
  const sx = 7.55, sw = W - M - sx;
  s.addShape(pptx.shapes.RECTANGLE, { x: sx - 0.25, y: 0.45, w: sw + 0.45, h: 6.65, fill: { color: C.card }, line: { color: C.line, width: 0.75 } });
  s.addText('SOURCES', { x: sx, y: 0.65, w: sw, h: 0.3, fontFace: SANS, fontSize: 13, bold: true, charSpacing: 3, color: C.muted, margin: 0 });
  const src = [
    ['AEA / EFHOH / EHIMA (EuroTrak), Getting the numbers right on hearing loss in Europe, 2024', 'https://www.ehima.com/wp-content/uploads/2024/03/Getting-the-numbers-right-on-Hearing-Loss-Hearing-Care-and-Hearing-Aid-Use-in-Europe-2024.pdf'],
    ['EHIMA / Anovum, EuroTrak Italy 2022', 'https://www.ehima.com/wp-content/uploads/2022/11/EuroTrak_Italy_2022.pdf'],
    ['Non-speech information in captions, EEG study, PMC7040021; May et al. 2025', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7040021/'],
    ['r/deaf, "Anyone else struggling with group conversations at work…" (35↑)', 'https://www.reddit.com/r/deaf/comments/1r2797f/'],
    ['r/deaf, "Exhausted and sad after family Sunday lunch" (36↑)', 'https://www.reddit.com/r/deaf/comments/1fh8h7h/'],
  ];
  const runs = [];
  src.forEach(([t, u], i) => {
    runs.push({ text: `${i + 1}  ${t}`, options: { color: C.text, breakLine: true, paraSpaceAfter: u ? 0 : 7 } });
    if (u) runs.push({ text: u, options: { color: C.blue, fontSize: 10.5, breakLine: true, paraSpaceAfter: 8, hyperlink: { url: u } } });
  });
  s.addText(runs, { x: sx, y: 1.05, w: sw, h: 5.9, fontFace: SANS, fontSize: 13, margin: 0, valign: 'top' });
}

pptx.writeFile({ fileName: OUT }).then((f) => console.log('wrote', f));
