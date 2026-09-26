// Builds pitch/I-Missed-That-BAINSA.pptx in the app's own design (design/DESIGN.md):
// cream page, ink type, amber the only accent. No icons, no shadows, no fills — hairlines only.
// Fonts: Georgia italic (stand-in for Fraunces), Calibri body (Nunito), Consolas labels (Space Mono).
// Run: NODE_PATH=$(npm root -g) node pitch/build/build.js
const path = require('path');
const pptxgen = require('pptxgenjs');

const OUT = path.join(__dirname, '..', 'I-Missed-That-BAINSA.pptx');
const A = (f) => path.join(__dirname, 'assets', f);

const C = { cream: 'F4EEE2', ink: '17130F', ink2: '5E554B', rule: 'D9D0C0', amber: 'E4A73A', go: '4C8C5C' };
const SERIF = 'Georgia', BODY = 'Calibri', MONO = 'Consolas';
const W = 13.333, H = 7.5, M = 0.75;

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.title = 'One at a time — BAINSA Hackathon 2026';

function base(notes) {
  const s = pptx.addSlide();
  s.background = { color: C.cream };
  if (notes) s.addNotes(notes);
  return s;
}
function label(s, text, o = {}) {
  s.addText(text.toUpperCase(), Object.assign({ x: M, y: 0.5, w: 10, h: 0.3, fontFace: MONO, fontSize: 11,
    color: C.ink2, charSpacing: 3, margin: 0, valign: 'top' }, o));
}
function headline(s, text, o = {}) {
  s.addText(text, Object.assign({ x: M, y: 0.9, w: W - 2 * M, h: 0.9, fontFace: SERIF, italic: true,
    fontSize: 36, color: C.ink, margin: 0, valign: 'top' }, o));
}
function rule(s, x, y, w, color = C.rule) {
  s.addShape(pptx.shapes.LINE, { x, y, w, h: 0, line: { color, width: 0.75 } });
}
function vrule(s, x, y, h) {
  s.addShape(pptx.shapes.LINE, { x, y, w: 0, h, line: { color: C.rule, width: 0.75 } });
}
// Phone frame: the screenshot with a 1px hairline border, no shadow.
function phone(s, file, x, y, h, aspect = 390 / 720) {
  const w = h * aspect;
  s.addImage({ path: A(file), x, y, w, h });
  s.addShape(pptx.shapes.RECTANGLE, { x, y, w, h, fill: { type: 'none' }, line: { color: C.rule, width: 1 } });
  return w;
}
const sup = (n) => ({ text: String(n), options: { superscript: true, color: C.ink2, fontFace: MONO } });

// ---------- 1. Title ----------
{
  const s = base(
    'Presenter hands a judge the listener phone.\n' +
    '"Every accessibility tool puts the burden on the deaf person. We built the other side. Hold this."\n\n' +
    'Fallback: if Deepgram acts up, switch to ?replay=demo2 — it reproduces the exact same cards deterministically.');
  label(s, 'BAINSA Hackathon 2026', { y: 0.6 });
  s.addText('One at a time.', { x: M, y: 2.0, w: 12, h: 2.2, fontFace: SERIF, italic: true,
    fontSize: 110, color: C.ink, margin: 0, valign: 'middle' });
  s.addText('The first accessibility tool for the hearing side of the table.',
    { x: M, y: 4.35, w: 11, h: 0.8, fontFace: SERIF, italic: true, fontSize: 28, color: C.ink2, margin: 0, valign: 'top' });
  rule(s, M, 6.55, W - 2 * M);
  label(s, 'Team · [Name] · [Name] · [Name] · [Name]', { y: 6.72, w: 8 });
  label(s, 'Milan · 2026', { x: W - M - 3, y: 6.72, w: 3, align: 'right' });
}

// ---------- 2. The flip ----------
{
  const s = base(
    'Q1: Who\'s speaking for me — what if it says something I didn\'t mean?\n' +
    'You pick the line and can edit it before it sends. It\'s autocomplete for the moment you\'re locked out of, not autopilot.');
  label(s, 'The flip');
  headline(s, 'Every tool puts the work on the person who can\'t hear.', { fontSize: 32 });
  s.addText([
    { text: 'They read faster, ask again, and get told “never mind.” Nobody asks the table to change anything. The people talking never find out they lost someone. ' },
    { text: 'We built the tool for the table.', options: { fontFace: SERIF, italic: true } },
  ], { x: M, y: 1.75, w: 11.6, h: 1.1, fontFace: BODY, fontSize: 21, color: C.ink, margin: 0, valign: 'top' });

  const quotes = [
    { q: '“I\'ve started just nodding along even when I have no idea what was decided. My boss mentioned something about a new client project last Thursday and I smiled and agreed but I genuinely don\'t know what I signed up for.”', src: 'r/deaf · 35↑', n: 5 },
    { q: '“DTS - Dinner Table Syndrome. Deaf people in hearing families are too familiar with this, myself included. It\'s simply too much work to follow along. Thats why you feel like you could sleep for a week, we have to work much harder than a hearing person to understand verbal conversations.”', src: 'r/deaf · family Sunday lunch thread, 36↑', n: 6 },
  ];
  const qy = 3.25, qw = 5.6, gap = 0.6;
  rule(s, M, qy, W - 2 * M);
  quotes.forEach((qq, i) => {
    const x = M + i * (qw + gap);
    s.addText(qq.q, { x, y: qy + 0.3, w: qw, h: 3.0, fontFace: SERIF, italic: true, fontSize: 19,
      color: C.ink, margin: 0, valign: 'top', lineSpacingMultiple: 1.1 });
    s.addText([{ text: qq.src.toUpperCase() + '  ' }, sup(qq.n)], { x, y: 6.55, w: qw, h: 0.35,
      fontFace: MONO, fontSize: 11, color: C.ink2, charSpacing: 2, margin: 0 });
  });
}

// ---------- 3. Numbers ----------
{
  const s = base(
    'Q10: Why family, and not work?\n' +
    'The numbers said so first: 56% say home with family is where hearing well matters most, against 21% for work. And a family will put their phones down for you in a way a client on a call never will.');
  label(s, 'The numbers');
  headline(s, 'Where they most want to hear is home.');
  const cells = [
    [[{ text: '50M' }], [{ text: 'people in the EU report trouble hearing. About ' }, { text: '1 in 9', options: { bold: true } }, { text: '.' }, sup(1)]],
    [[{ text: '56%', options: { color: C.amber } }, { text: ' vs 21%', options: { color: C.ink2, fontSize: 34 } }],
      [{ text: 'The ' }, { text: 'family table', options: { bold: true } }, { text: ' is the #1 place they want to hear. Work: 21%. EuroTrak Italy 2022.' }, sup(2)]],
    [[{ text: '170' }, { text: ' wpm', options: { color: C.ink2, fontSize: 34 } }],
      [{ text: 'Caption comprehension collapses above it. Group speech runs ' }, { text: '160–220', options: { bold: true } }, { text: '.' }, sup(3)]],
    [[{ text: '4%' }], [{ text: 'of sampled videos caption non-speech sound: the laugh, the tone.' }, sup(4)]],
  ];
  const cw = 5.6, gx = 0.6, ch = 2.25, y0 = 1.95;
  cells.forEach(([big, txt], i) => {
    const x = M + (i % 2) * (cw + gx), y = y0 + Math.floor(i / 2) * ch;
    rule(s, x, y, cw);
    s.addText(big, { x, y: y + 0.15, w: cw, h: 1.0, fontFace: SERIF, italic: true, fontSize: 58, color: C.ink, margin: 0, valign: 'middle' });
    s.addText(txt, { x, y: y + 1.2, w: cw, h: 0.9, fontFace: BODY, fontSize: 18, color: C.ink, margin: 0, valign: 'top' });
  });
  label(s, 'Hard-of-hearing and late-deafened adults · EU27 figure derived from the 59M Europe total · sources on the last slide',
    { y: 6.6, w: W - 2 * M, fontSize: 10 });
}

// ---------- 4. The table: three phone frames ----------
{
  const s = base(
    'Lamp: their phone — "Go ahead" in green, "One at a time" in amber when two people overlap. No red state.\n' +
    'Listener: your phone — one sentence, the name, and the tone when it isn\'t neutral (e.g. Mom · TEASING). Say something is one tap.\n' +
    'Map: where the conversation went — who talked to whom, about what, and how it felt.\n\n' +
    'Q2: Doesn\'t the amber light shame the fast talker? It\'s amber; there is no red state — ambient light on their own phones, a mirror, not a scolding.');
  label(s, 'The table');
  const ph = 4.85, pw = ph * 390 / 720, colW = (W - 2 * M) / 3, py = 1.2;
  const items = [
    ['oat-lamp.png', 'Lamp', 'their phone', 'Go ahead · One at a time'],
    ['oat-listener.png', 'Listener', 'your phone', 'One sentence · name · tone · Say something'],
    ['oat-map.png', 'Map', 'where it went', 'Who, to whom, about what'],
  ];
  items.forEach(([f, lab, cap, sub], i) => {
    const cx = M + i * colW + colW / 2;
    label(s, lab, { x: cx - colW / 2, y: 0.85, w: colW, align: 'center' });
    phone(s, f, cx - pw / 2, py, ph);
    s.addText(cap, { x: cx - colW / 2, y: py + ph + 0.12, w: colW, h: 0.5, fontFace: SERIF, italic: true,
      fontSize: 26, color: C.ink, margin: 0, align: 'center', valign: 'top' });
    label(s, sub, { x: cx - colW / 2, y: py + ph + 0.68, w: colW, align: 'center', fontSize: 9 });
  });
}

// ---------- 5. What the listener gets back ----------
{
  const s = base(
    'How do you know the tone is right?\n' +
    'It\'s the same classifier that knows the line was for you; we show it only when it isn\'t neutral, and voice loudness and speed feed it.\n\n' +
    'Sentence under 1 second. Tone in 0.7 s. Plans refreshed every 10 s. Laugh detection needs no audio model. Nothing is stored.');
  label(s, 'What the listener gets back');
  headline(s, 'What a voice carries, on one screen.', { w: 8.4 });
  const rows = [
    ['Who', [{ text: 'Every line named. The phones are the mics.' }]],
    ['How it was said', [{ text: 'Tone in 0.7 s: ' }, { text: 'warm, teasing, annoyed.', options: { fontFace: SERIF, italic: true } }]],
    ['What was agreed', [{ text: 'Plans with the reason, refreshed every 10 s.' }]],
    ['When they laughed', [{ text: '“The table laughed.” No audio model.' }]],
  ];
  const lx = M, lw = 8.3, rh = 0.9;
  let y = 2.05;
  rows.forEach(([k, v]) => {
    rule(s, lx, y, lw);
    s.addText(k.toUpperCase(), { x: lx, y: y + 0.28, w: 2.5, h: 0.35, fontFace: MONO, fontSize: 12, color: C.ink, charSpacing: 3, margin: 0, valign: 'top' });
    s.addText(v, { x: lx + 2.6, y: y + 0.22, w: lw - 2.6, h: 0.6, fontFace: BODY, fontSize: 20, color: C.ink, margin: 0, valign: 'top' });
    y += rh;
  });
  rule(s, lx, y, lw);
  s.addShape(pptx.shapes.OVAL, { x: lx, y: y + 0.36, w: 0.26, h: 0.26, fill: { color: C.amber }, line: { color: C.amber, width: 0 } });
  s.addText('Your name is called: the whole phone turns amber in under 1 s.', { x: lx + 0.45, y: y + 0.2, w: lw - 0.45, h: 0.8,
    fontFace: SERIF, italic: true, fontSize: 24, color: C.ink, margin: 0, valign: 'top' });
  phone(s, 'oat-listener-asked.png', 9.55, 1.1, 5.6);
}

// ---------- 6. What's new ----------
{
  const s = base(
    'Q8: Why not just use Ava or Otter?\n' +
    'Ava gets you named mics from every phone — genuinely good, and we don\'t compete on it. Otter and Zoom summarize after the fact. Neither one has ever turned around and told the people talking to slow down.');
  label(s, 'What\'s new, honestly');
  headline(s, 'Everyone else builds for the listener.');
  const cols = [2.7, 4.2, W - 2 * M - 6.9];
  const rows = [
    ['TOOL', 'ALREADY DOES', 'DOESN\'T DO'],
    ['Ava', 'Phones as named mics, for captions', 'Never sends pace or overlap back to the speakers\' own phones'],
    ['Otter / Zoom', 'Summarize the conversation', 'Only after it\'s over'],
    ['Caption glasses', 'Words in front of the listener\'s eyes', 'Put more on the deaf person, nothing the table can act on'],
    ['One at a time', 'Phones as mics, like Ava', 'Amber on the talkers\' phones. One sentence, one tap, back to the table.'],
  ];
  let y = 2.0;
  rows.forEach((r, i) => {
    const head = i === 0, us = i === rows.length - 1;
    const rh = head ? 0.5 : 0.82;
    rule(s, M, y, W - 2 * M, us ? C.ink : C.rule);
    let x = M;
    r.forEach((t, j) => {
      s.addText(t, head
        ? { x, y: y + 0.14, w: cols[j] - 0.2, h: 0.3, fontFace: MONO, fontSize: 11, color: C.ink2, charSpacing: 3, margin: 0, valign: 'top' }
        : { x, y: y + 0.14, w: cols[j] - 0.25, h: rh - 0.2, fontFace: BODY, fontSize: 18, bold: j === 0, color: C.ink, margin: 0, valign: 'top' });
      x += cols[j];
    });
    y += rh;
  });
  s.addText([
    { text: 'Ava does the mics. ', options: { color: C.ink } },
    { text: 'We do the other side of the table.', options: { color: C.amber } },
  ], { x: M, y: y + 0.35, w: W - 2 * M, h: 0.8, fontFace: SERIF, italic: true, fontSize: 32, margin: 0, valign: 'top' });
}

// ---------- 7. Scope, limits, next + Sources ----------
{
  const s = base(
    'Q3: Why not build for sign-first Deaf users?\n' +
    'Scoped out on purpose. Sign-first Deaf users are often better served by an interpreter or a full visual language — a different, well-served problem. We target hard-of-hearing and late-deafened adults in rooms full of hearing people.\n\n' +
    'Close: "One sentence. One word on their phones. One tap. Ava does the mics. We do the other side of the table." Then swipe to the map: "and this is where the conversation went."');
  label(s, 'Scope · limits · next');
  headline(s, 'What this is, and isn\'t.', { w: 6.4 });
  const items = [
    ['For', 'Hard-of-hearing and late-deafened adults in hearing rooms.'],
    ['Not for', 'Sign-first Deaf users.'],
    ['Tested', 'Not yet tested with a hard-of-hearing user.'],
    ['Reach', '~10M in the EU could use it. Tonight it reaches a table.'],
    ['Languages', 'Italian and Turkish verified, plus English.'],
    ['Next', 'User tests with hard-of-hearing people. A real voice on the phones (ElevenLabs slot). Look-away catch-up is already built.'],
  ];
  let y = 1.8;
  const lw = 6.3;
  items.forEach(([k, v]) => {
    const h = k === 'Next' ? 1.05 : 0.72;
    rule(s, M, y, lw);
    s.addText(k.toUpperCase(), { x: M, y: y + 0.16, w: 1.4, h: 0.3, fontFace: MONO, fontSize: 10, color: C.ink2, charSpacing: 3, margin: 0, valign: 'top' });
    s.addText(v, { x: M + 1.5, y: y + 0.12, w: lw - 1.5, h: h - 0.15, fontFace: BODY, fontSize: 16, color: C.ink, margin: 0, valign: 'top' });
    y += h;
  });

  const sx = 7.65, sw = W - M - sx;
  vrule(s, sx - 0.35, 0.5, 6.5);
  s.addText('SOURCES', { x: sx, y: 0.5, w: sw, h: 0.3, fontFace: MONO, fontSize: 11, color: C.ink2, charSpacing: 3, margin: 0 });
  const src = [
    ['AEA / EFHOH / EHIMA, Getting the numbers right on hearing loss in Europe, 2024. 59M Europe; EU27 ≈50M is our arithmetic.', 'https://www.ehima.com/wp-content/uploads/2024/03/Getting-the-numbers-right-on-Hearing-Loss-Hearing-Care-and-Hearing-Aid-Use-in-Europe-2024.pdf'],
    ['EHIMA / Anovum, EuroTrak Italy 2022, p. 60.', 'https://www.ehima.com/wp-content/uploads/2022/11/EuroTrak_Italy_2022.pdf'],
    ['Caption reading speed vs. conversational pace: synthesis of captioning-speed studies (research/05-numbers-for-pitch.md); not a single primary source.', null],
    ['Non-speech information in captions, PMC7040021; May et al., 2025.', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7040021/'],
    ['r/deaf, "Anyone else struggling with group conversations at work…" (35↑)', 'https://www.reddit.com/r/deaf/comments/1r2797f/'],
    ['r/deaf, "Exhausted and sad after family Sunday lunch" (36↑)', 'https://www.reddit.com/r/deaf/comments/1fh8h7h/'],
  ];
  const runs = [];
  src.forEach(([t, u], i) => {
    runs.push({ text: `${i + 1}  ${t}`, options: { color: C.ink, breakLine: true, paraSpaceAfter: u ? 1 : 8 } });
    if (u) runs.push({ text: u, options: { color: C.ink2, fontFace: MONO, fontSize: 8, breakLine: true, paraSpaceAfter: 8, hyperlink: { url: u } } });
  });
  s.addText(runs, { x: sx, y: 0.95, w: sw, h: 6.0, fontFace: BODY, fontSize: 11.5, margin: 0, valign: 'top' });
}

pptx.writeFile({ fileName: OUT }).then((f) => console.log('wrote', f));
