// Streams synthesized speech into the server as named participants (like phones), so the live path
// (Deepgram -> room -> host -> Claude) can be tested without humans.
//
// Usage:
//   node tools/fake-phones.mjs [wsBase] [scenario.json] [flags]
//   node tools/fake-phones.mjs --scenario demo2 --voices Samantha,Daniel,Karen --overlap --host
// Flags:
//   --scenario <name|path>  demo1/demo2 (client/public/replay/<name>.json) or a JSON path. Default demo1.
//   --voices a,b,c          macOS voices mapped by speaker index. Default Daniel,Samantha,Karen.
//   --rate <wpm>            `say -r` rate. Default 185.
//   --overlap               next line starts 40% before the previous one ends (two phones talk at once).
//   --noise <wav>           background mixed into every phone (and the host mix) at -18 dB, looped.
//   --host                  ALSO stream the mixed room signal into a role=host socket ("host mic hears everyone").
//   --drop <idx>@<sec>      phone <idx> drops (terminate) at <sec> s mid-stream and reconnects 1.5 s later.
//   --say <text>            after the scenario, POST /api/room/say and count which phones got it.
//   --no-drive              don't simulate the host client's /api/gate + /api/state (8 s, 90 s window) + /api/catchup calls.
//   --repeat <n>            play the script n times back to back (n=2 gives a ~2 min run, i.e. full 90 s ledger windows).
//   --json <path>           write the summary as JSON too.
//   --tone-report           per scripted line with an expected `tone` (demo2.json): the gate's raw tone, the client's
//                           smoothed (displayed) tone and the final's prosody; prints raw + smoothed accuracy.
//   --rates a,b,c           per-speaker `say -r` rates (overrides --rate for that speaker index), e.g. 185,230,185.
//   --bleed                 each line is ALSO mixed at -12 dB into one neighbouring phone (its mic hears the next seat);
//                           the summary counts cross-speaker copies (a final whose best script match is someone else's line).
//   --loud-lines i,j        scale those script lines (index into the text lines) x2.5: tests the prosody 'loud' path.
//   --enroll                single-phone voice id: first POST a 5 s enrollment clip per speaker (same `say` voice, different
//                           words) to /api/voice/enroll, then stream ONLY a mixed host mic (no phones, diarization on) and
//                           report host finals whose voiceName == the script speaker. With --bleed: phones stream as usual
//                           (multi-phone + fingerprints) and the report counts phone finals re-named by voice.
// Every phone streams continuously (silence/noise between lines) in 100 ms chunks, in real time, like a real mic.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WebSocket = createRequire(join(ROOT, 'server/package.json'))('ws');

// ---------- args ----------
const argv = process.argv.slice(2);
const flags = {}; const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { pos.push(a); continue; }
  const k = a.slice(2);
  if (['overlap', 'host', 'no-drive', 'tone-report', 'bleed', 'enroll'].includes(k)) flags[k] = true;
  else flags[k] = argv[++i];
}
const base = pos[0] ?? flags.base ?? 'ws://localhost:8787';
const http = base.replace(/^ws/, 'http');
const scenArg = flags.scenario ?? pos[1] ?? 'demo1';
const scenPath = existsSync(scenArg) ? scenArg : join(ROOT, 'client/public/replay', `${scenArg.replace(/\.json$/, '')}.json`);
const scenario = JSON.parse(readFileSync(scenPath, 'utf8'));
const names = scenario.names ?? { 0: 'Alex', 1: 'Sam', 2: 'Priya' };
const voiceList = (flags.voices ?? 'Daniel,Samantha,Karen').split(',').map((s) => s.trim());
const RATE = Number(flags.rate) || 185;
const RATES = (flags.rates ?? '').split(',').map((s) => Number(s.trim()) || RATE);
const rateOf = (speaker) => RATES[Number(speaker)] || RATE;
const OVERLAP = !!flags.overlap;
const ENROLL = !!flags.enroll;
const SINGLE = ENROLL && !flags.bleed; // one host mic hears everyone; no phones
const HOST = !!flags.host || SINGLE;
const DRIVE = !flags['no-drive'];
const drop = flags.drop ? { idx: flags.drop.split('@')[0], at: Number(flags.drop.split('@')[1]) * 1000 } : null;

const SR = 16_000, CHUNK = 1600; // samples per 100 ms
const GAP_MS = 350;               // normal mode: pause between turns
const NOISE_GAIN = 10 ** (-18 / 20);
const HOST_GAIN = 0.6;            // the host mic is further away than each phone

mkdirSync('/tmp/imt-tts', { recursive: true });
const token = JSON.parse(execSync(`curl -s ${http}/api/room`).toString()).token;

function pcm16k(text, voice, rate = RATE) {
  const key = Buffer.from(`${text}|${voice}|${rate}`).toString('base64url').slice(-48);
  const aiff = `/tmp/imt-tts/${key}.aiff`, raw = `/tmp/imt-tts/${key}.raw`;
  if (!existsSync(raw)) {
    execSync(`say -v "${voice}" -r ${rate} -o "${aiff}" ${JSON.stringify(text)}`);
    execSync(`ffmpeg -loglevel error -y -i "${aiff}" -ac 1 -ar 16000 -f s16le "${raw}"`);
  }
  const b = readFileSync(raw);
  return new Int16Array(b.buffer, b.byteOffset, b.length / 2);
}

// ---------- voice enrollment (--enroll): 5 s per speaker, words the script never uses ----------
const ENROLL_TEXT = [
  "Hi, this is my voice for the table. Sunday lunch is at one, and everyone brings a side dish, please don't forget the bread this time.",
  "Hello, this is me talking for a few seconds. I'll handle the grill, but someone has to pick up the charcoal from the shop before noon.",
  "Hey, it's me, reading this out loud. I can't do evenings anymore, so let's keep it early and keep it simple for everyone.",
];
if (ENROLL) {
  for (const [k, id] of Object.keys(names).entries()) {
    const pcm = pcm16k(ENROLL_TEXT[k % ENROLL_TEXT.length], voiceList[id] ?? voiceList[0], rateOf(id));
    const clip = Buffer.from(pcm.buffer, pcm.byteOffset, Math.min(pcm.length, 5 * SR) * 2);
    const r = await fetch(`${http}/api/voice/enroll?token=${encodeURIComponent(token)}&name=${encodeURIComponent(names[id])}`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: clip });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) { console.error(`enroll ${names[id]} failed: ${r.status} ${JSON.stringify(j)}`); process.exit(1); }
    console.log(`enrolled ${names[id]} (${voiceList[id]}, ${(clip.length / 2 / SR).toFixed(1)} s) table threshold=${j.threshold} self=${j.self} cross=${j.cross}`);
  }
}

// ---------- schedule ----------
const REPEAT = Math.max(1, Number(flags.repeat) || 1);
const script = scenario.lines.filter((l) => l.text).sort((a, b) => a.t - b.t);
const LOUD = new Set((flags['loud-lines'] ?? '').split(',').filter(Boolean).map(Number));
const louder = (pcm) => Int16Array.from(pcm, (v) => Math.max(-32768, Math.min(32767, Math.round(v * 2.5))));
const lines = Array.from({ length: REPEAT }, () => script).flat().map((l, i) => {
  const pcm = pcm16k(l.text, voiceList[l.speaker] ?? voiceList[0] ?? 'Alex', rateOf(l.speaker));
  return { ...l, loud: LOUD.has(i % script.length), pcm: LOUD.has(i % script.length) ? louder(pcm) : pcm };
});
let cursor = 0, overlaps = 0;
const busyUntil = {};
for (const [i, l] of lines.entries()) {
  const dur = (l.pcm.length / SR) * 1000;
  let start = cursor;
  if (i > 0) {
    const prev = lines[i - 1];
    start = OVERLAP ? prev.start + prev.dur * 0.6 : prev.start + prev.dur + GAP_MS;
  }
  start = Math.max(start, (busyUntil[l.speaker] ?? 0) + 200); // one phone can't overlap itself
  if (i > 0 && start < lines[i - 1].start + lines[i - 1].dur) overlaps++;
  Object.assign(l, { start: Math.round(start), dur: Math.round(dur) });
  busyUntil[l.speaker] = start + dur;
  cursor = start + dur;
}
const totalMs = Math.ceil(Math.max(...lines.map((l) => l.start + l.dur)) + 4000);
const nChunks = Math.ceil(totalMs / 100);
const speakerIds = Object.keys(names);

let noise = null;
if (flags.noise) {
  const b = execSync(`ffmpeg -loglevel error -i "${flags.noise}" -ac 1 -ar 16000 -f s16le -`, { maxBuffer: 1 << 28 });
  noise = new Int16Array(b.buffer, b.byteOffset, b.length / 2);
}
const clamp = (v) => Math.max(-32768, Math.min(32767, Math.round(v)));
const tracks = {};
for (const id of speakerIds) tracks[id] = new Float32Array(nChunks * CHUNK);
for (const l of lines) {
  const tr = tracks[l.speaker]; const off = Math.round((l.start / 1000) * SR);
  for (let j = 0; j < l.pcm.length && off + j < tr.length; j++) tr[off + j] += l.pcm[j];
}
if (flags.bleed) {
  const BLEED_GAIN = 10 ** (-12 / 20);
  for (const l of lines) {
    const k = speakerIds.indexOf(String(l.speaker));
    const tr = tracks[speakerIds[(k + 1) % speakerIds.length]]; const off = Math.round((l.start / 1000) * SR);
    for (let j = 0; j < l.pcm.length && off + j < tr.length; j++) tr[off + j] += l.pcm[j] * BLEED_GAIN;
  }
}
const hostTrack = new Float32Array(nChunks * CHUNK);
for (const id of speakerIds) { const tr = tracks[id]; for (let j = 0; j < tr.length; j++) hostTrack[j] += tr[j] * HOST_GAIN; }
function addNoise(tr, phase) {
  if (!noise?.length) return;
  for (let j = 0; j < tr.length; j++) tr[j] += noise[(j + phase) % noise.length] * NOISE_GAIN;
}
speakerIds.forEach((id, k) => addNoise(tracks[id], k * 7919 * 11)); // offset per phone so noise isn't identical
addNoise(hostTrack, 3 * 7919 * 11);
const chunkOf = (tr, i) => {
  const out = Buffer.alloc(CHUNK * 2);
  for (let j = 0; j < CHUNK; j++) out.writeInt16LE(clamp(tr[i * CHUNK + j] ?? 0), j * 2);
  return out;
};

// ---------- stats ----------
const S = {
  finals: {}, interims: {}, hostFinals: 0, hostFinalsDup: 0, hostFinalsUnique: [],
  pace: {}, paceOverlap: 0, tableOverlap: 0, statusErrors: [], closes: [],
  gate: [], state: [], catchup: null, moods: [], http: {}, say: null, merged: [], missed: [], ledgerItems: 0, provisionalLeft: 0,
};
for (const id of speakerIds) { S.finals[names[id]] = 0; S.pace[names[id]] = { ok: 0, fast: 0, too_fast: 0, maxWpm: 0 }; }
const partFinals = [];   // {name, text, tokens, at, tStart, tEnd, speaker}
const toks = (t) => new Set(t.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').split(/\s+/).filter(Boolean));
const frac = (a, b) => { if (!a.size) return 0; let n = 0; for (const w of a) if (b.has(w)) n++; return n / a.size; };
const t0 = Date.now();
const el = () => ((Date.now() - t0) / 1000).toFixed(1);

// ---------- host / monitor socket ----------
let dirty = false;
const speakersMap = {};
function onHostMsg(j) {
  if (j.type === 'status' && (j.state === 'error')) S.statusErrors.push(`host: ${j.detail ?? ''}`);
  if (j.type === 'table' && j.overlap) S.tableOverlap++;
  if (ENROLL && j.type === 'transcript' && !j.final && !j.name && j.text.trim()) (S.interimsV ??= []).push({ voiceName: j.voiceName, voiceScore: j.voiceScore, text: j.text, tokens: toks(j.text), tStart: j.tStart, tEnd: j.tEnd });
  if (j.type !== 'transcript' || !j.final || !j.text.trim()) return;
  const at = Date.now();
  if (j.voiceName || ENROLL) (S.voice ??= []).push({ phone: !!j.name, name: j.name, voiceName: j.voiceName, voiceScore: j.voiceScore, text: j.text, tokens: toks(j.text), speaker: j.speaker, tStart: j.tStart, tEnd: j.tEnd });
  if (j.name) {
    S.finals[j.name] = (S.finals[j.name] ?? 0) + 1;
    speakersMap[j.speaker] = { id: j.speaker, name: j.name, color: '#888' };
    const f = { name: j.name, text: j.text, tokens: toks(j.text), at, tStart: j.tStart, tEnd: j.tEnd, speaker: j.speaker, ...(j.prosody ? { prosody: j.prosody } : {}) };
    partFinals.push(f);
    const pr = j.prosody ? `  {${j.prosody.loud}/${j.prosody.rate}/+${j.prosody.pauseBeforeMs}ms}` : '';
    console.log(`  [final ${el()}s] ${j.name}: ${j.text}${pr}`);
    dirty = true;
    if (DRIVE) void driveGate(f);
  } else {
    S.hostFinals++;
    // Same rule as the client guard (useSession): host tokens vs the UNION of phone finals from
    // [start of the host line - 2.5 s, +2.5 s after it] (the client holds host lines 2.5 s for a late phone copy).
    const tk = toks(j.text);
    const from = at - Math.max(0, j.tEnd - j.tStart) - 2500;
    setTimeout(() => {
      const u = new Set(); for (const f of partFinals) if (f.at >= from && f.at <= at + 2500) for (const w of f.tokens) u.add(w);
      if (frac(tk, u) >= 0.6) S.hostFinalsDup++; else S.hostFinalsUnique.push(j.text);
    }, 2600);
    console.log(`  [host-mic ${el()}s]${j.voiceName ? ` ${j.voiceName}${j.voiceScore != null ? `(${j.voiceScore})` : '(mapped)'}:` : ` dg${j.speaker}:`} ${j.text}`);
  }
}
// Like the real host client (useSession): tell the room the listener's name (phones' "Good pace for", Deepgram keyterm).
execSync(`curl -s -X POST -H 'content-type: application/json' -d '{"name":"Bera"}' ${http}/api/room/me`);
const hostSock = new WebSocket(`${base}/ws/audio?role=host&token=${token}`);
hostSock.on('message', (m) => { try { onHostMsg(JSON.parse(m.toString())); } catch { /* ignore */ } });
hostSock.on('close', (c, r) => S.closes.push(`host ${c} ${r}`));
await new Promise((res, rej) => { hostSock.on('open', res); hostSock.on('error', rej); });

// ---------- phones ----------
const socks = {};
function openPhone(id) {
  const name = names[id];
  return new Promise((res, rej) => {
    const ws = new WebSocket(`${base}/ws/audio?role=participant&name=${encodeURIComponent(name)}&token=${token}`);
    ws.on('message', (m) => {
      let j; try { j = JSON.parse(m.toString()); } catch { return; }
      if (j.type === 'pace') {
        const p = S.pace[name]; p[j.level]++; p.maxWpm = Math.max(p.maxWpm, j.wpm);
        if (j.overlap) S.paceOverlap++;
        if (j.level !== 'ok' || j.overlap) console.log(`  [pace ${name}] ${j.wpm} wpm ${j.level}${j.overlap ? ' OVERLAP' : ''}`);
      }
      if (j.type === 'status' && j.state === 'error') S.statusErrors.push(`${name}: ${j.detail ?? ''}`);
      if (j.type === 'say') (S.sayGot ??= new Set()).add(name);
    });
    ws.on('close', (c, r) => { if (!ws._dropped) S.closes.push(`${name} ${c} ${r}`); });
    ws.on('open', () => res(ws));
    ws.on('error', rej);
  });
}
if (!SINGLE) for (const id of speakerIds) socks[id] = await openPhone(id);
console.log(`room ${token}: ${SINGLE ? 0 : speakerIds.length} phones + host${HOST ? ' (mixed mic)' : ' (monitor)'} connected; ${lines.length} lines, ${(totalMs / 1000).toFixed(0)} s, overlap=${OVERLAP} (${overlaps} overlapping pairs) noise=${!!noise} drive=${DRIVE}`);

// ---------- client simulation (/api/gate per final, /api/state every 8 s, /api/catchup at end) ----------
const me = { name: 'Bera', aliases: [] };
const utt = (f, i) => ({ id: `u${f.speaker}-${f.tStart}-${i}`, type: 'utterance', speaker: f.speaker, text: f.text, tStart: f.tStart, tEnd: f.tEnd, final: true, ...(f.threadId ? { threadId: f.threadId } : {}), ...(f.prosody ? { prosody: f.prosody } : {}), ...(f.tone ? { toneRaw: f.tone, ...(f.shown !== 'neutral' ? { tone: f.shown } : {}) } : {}) });
async function post(path, body) {
  const s = Date.now();
  try {
    const r = await fetch(`${http}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
    S.http[`${path} ${r.status}`] = (S.http[`${path} ${r.status}`] ?? 0) + 1;
    const j = await r.json().catch(() => ({}));
    return { ms: Date.now() - s, status: r.status, j };
  } catch (e) {
    S.http[`${path} ERR`] = (S.http[`${path} ERR`] ?? 0) + 1;
    return { ms: Date.now() - s, status: 0, j: {}, err: String(e?.message ?? e) };
  }
}
// Mirror of client/src/state/useGate.ts smoothing: the displayed tone only changes when the new raw tone repeats
// (2 of the speaker's last 3 lines) or is 'urgent'; otherwise the speaker's previous non-neutral displayed tone stays.
const toneHist = {}, toneShown = {};
function smoothTone(speaker, raw) {
  const h = (toneHist[speaker] ??= []); h.push(raw); if (h.length > 3) h.shift();
  if (raw === 'urgent' || h.filter((t) => t === raw).length >= 2) toneShown[speaker] = raw;
  return toneShown[speaker] ?? 'neutral';
}
async function driveGate(f) {
  const all = partFinals.map(utt);
  const r = await post('/api/gate', { me, speakers: speakersMap, recent: all.slice(-7, -1), target: all[all.length - 1] });
  S.gate.push({ ms: r.ms, server: r.j.latencyMs, source: r.j.source });
  f.tone = r.j.tone ?? 'neutral';
  f.shown = smoothTone(f.speaker, f.tone);
  if (flags['tone-report']) console.log(`  [tone ${el()}s] ${f.name}: ${f.tone}${f.shown !== f.tone ? ` (shown ${f.shown})` : ''} :: ${f.text.slice(0, 50)}`);
}
let ledger = [], threads = [], stateInflight = false;
const nowT = () => Math.max(0, ...partFinals.map((f) => f.tEnd)) + 500;
async function driveState() {
  if (!dirty || stateInflight) return;
  dirty = false; stateInflight = true;
  const now = nowT();
  const win = partFinals.map(utt).filter((u) => u.tEnd >= now - 90_000);
  const r = await post('/api/state', { me, speakers: speakersMap, window: win, nowT: now, existing: ledger, existing_threads: threads });
  if (r.status === 200 && !r.j.degraded) {
    ledger = r.j.ledger ?? ledger; threads = r.j.threads ?? threads;
    // stamp lanes on lines like the client reducer does, so the next call only labels new lines
    for (const ut of r.j.utteranceThreads ?? []) { const f = partFinals.find((x) => x.tStart === ut.t); if (f) f.threadId = ut.threadId; }
  } else dirty = true;
  S.state.push({ ms: r.ms, server: r.j.latencyMs, status: r.status, items: (r.j.ledger ?? []).length, win: win.length, degraded: !!r.j.degraded, err: r.err });
  if (r.j.mood) S.moods.push(r.j.mood);
  const md = r.j.mood ? ` mood=${r.j.mood.table}${r.j.mood.speakers?.length ? ` {${r.j.mood.speakers.map((x) => `${x.name}:${x.mood}`).join(' ')}}` : ''}` : '';
  console.log(`  [state ${el()}s] ${r.status} ${r.ms}ms win=${win.length} ledger=${(r.j.ledger ?? []).length}${md}${r.j.degraded ? ' DEGRADED' : ''}`);
  stateInflight = false;
}
const stateTimer = DRIVE ? setInterval(() => void driveState(), 8000) : null;

// ---------- real-time stream ----------
let li = 0;
const startAt = Date.now();
for (let i = 0; i < nChunks; i++) {
  const due = startAt + i * 100;
  const wait = due - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const tMs = i * 100;
  while (li < lines.length && lines[li].start <= tMs) { const l = lines[li++]; console.log(`[${(l.start / 1000).toFixed(1)}s] ${names[l.speaker]}: ${l.text}`); }
  if (drop && tMs === Math.round(drop.at / 100) * 100 && socks[drop.idx]) {
    const ws = socks[drop.idx]; ws._dropped = true; ws.terminate(); socks[drop.idx] = null;
    console.log(`  [drop] ${names[drop.idx]} terminated at ${el()}s; reconnecting in 1.5 s`);
    setTimeout(async () => { socks[drop.idx] = await openPhone(drop.idx); console.log(`  [drop] ${names[drop.idx]} back at ${el()}s`); }, 1500);
  }
  for (const id of speakerIds) { const ws = socks[id]; if (ws?.readyState === WebSocket.OPEN) ws.send(chunkOf(tracks[id], i)); }
  if (HOST && hostSock.readyState === WebSocket.OPEN) hostSock.send(chunkOf(hostTrack, i));
}
await new Promise((r) => setTimeout(r, 2500));

if (flags.say) {
  const r = await post('/api/room/say', { text: flags.say });
  await new Promise((res) => setTimeout(res, 500));
  S.say = { delivered: r.j.delivered, got: [...(S.sayGot ?? [])] };
}
if (DRIVE) {
  clearInterval(stateTimer);
  while (stateInflight) await new Promise((r) => setTimeout(r, 200));
  dirty = true; await driveState();
  const now = nowT();
  const r = await post('/api/catchup', { me, speakers: speakersMap, window: partFinals.map(utt), sinceT: Math.max(0, now - 5 * 60_000), nowT: now });
  S.catchup = { ms: r.ms, server: r.j.latencyMs, status: r.status, bullets: (r.j.bullets ?? []).length };
  S.ledgerItems = ledger.length;
}
for (const ws of Object.values(socks)) ws?.send(JSON.stringify({ type: 'stop' }));
hostSock.send(JSON.stringify({ type: 'stop' }));
await new Promise((r) => setTimeout(r, 300));

// ---------- merged / missed sentences (vs the script) ----------
for (const f of partFinals) {
  const script = [...new Map(lines.filter((l) => names[l.speaker] === f.name).map((l) => [l.text, l])).values()]; // unique lines (--repeat)
  const hits = script.filter((l) => frac(toks(l.text), f.tokens) >= 0.5);
  if (hits.length > 1) S.merged.push(`${f.name}: "${f.text}"`);
}
for (const l of lines) {
  const tk = toks(l.text);
  const got = partFinals.filter((f) => f.name === names[l.speaker]).reduce((a, f) => a + frac(tk, f.tokens) * tk.size, 0);
  if (got / tk.size < 0.5) S.missed.push(`${names[l.speaker]}: "${l.text}"`);
}

// ---------- cross-speaker copies: a final whose best script match (any speaker) is someone else's line ----------
S.crossDup = [];
{
  const minFrac = (a, b) => { const [x, y] = a.size <= b.size ? [a, b] : [b, a]; if (!x.size) return 0; let n = 0; for (const w of x) if (y.has(w)) n++; return n / x.size; };
  const uniq = [...new Map(lines.map((l) => [`${l.speaker}|${l.text}`, l])).values()];
  for (const f of partFinals) {
    let best = null, bc = 0;
    for (const l of uniq) { const c = minFrac(f.tokens, toks(l.text)); if (c > bc) { bc = c; best = l; } }
    if (best && bc >= 0.55 && names[best.speaker] !== f.name && f.tokens.size >= 2) S.crossDup.push(`${f.name} got ${names[best.speaker]}'s "${f.text}"`);
  }
}
// ---------- name accuracy: script lines naming the listener, did the final spell the name right? ----------
const nameRe = new RegExp(`\\b${me.name}\\b`);
S.name = { lines: 0, hit: 0, got: [] };
for (const l of lines.filter((x) => nameRe.test(x.text))) {
  S.name.lines++;
  const tk = toks(l.text);
  const best = partFinals.filter((f) => f.name === names[l.speaker]).sort((a, b) => frac(tk, b.tokens) - frac(tk, a.tokens))[0];
  if (best && nameRe.test(best.text)) S.name.hit++;
  S.name.got.push(best?.text ?? '(none)');
}
// ---------- fragmented: a script line that >= 2 finals match best (each final -> its best script line) ----------
S.fragmented = [];
{
  const uniq = [...new Map(lines.map((l) => [`${l.speaker}|${l.text}`, l])).values()];
  const n = new Map();
  for (const f of partFinals) {
    let best = null, bc = 0;
    for (const l of uniq) if (names[l.speaker] === f.name) { const c = frac(f.tokens, toks(l.text)); if (c > bc) { bc = c; best = l; } }
    if (best && bc >= 0.3) n.set(best, (n.get(best) ?? 0) + 1);
  }
  for (const [l, c] of n) if (c >= 2 * REPEAT) S.fragmented.push(`${names[l.speaker]}: "${l.text}"`);
}
// ---------- tone report: expected (scenario `tone`) vs the gate's raw + smoothed tone ----------
S.tone = null;
if (flags['tone-report']) {
  const rows = [];
  for (const l of lines) {
    const tk = toks(l.text);
    const best = partFinals.filter((f) => f.name === names[l.speaker]).map((f) => ({ f, c: frac(tk, f.tokens) })).sort((a, b) => b.c - a.c)[0];
    const f = best && best.c >= 0.5 ? best.f : null;
    rows.push({ who: names[l.speaker], text: l.text, want: l.tone ?? '', raw: f?.tone ?? '-', shown: f?.shown ?? '-', prosody: f?.prosody, loud: l.loud });
  }
  console.log('\n===== TONE REPORT =====');
  console.log('expected  raw       shown     prosody               line');
  for (const r of rows) {
    const p = r.prosody ? `${r.prosody.loud}/${r.prosody.rate}/+${r.prosody.pauseBeforeMs}` : '';
    console.log(`${(r.want || '.').padEnd(10)}${r.raw.padEnd(10)}${r.shown.padEnd(10)}${p.padEnd(22)}${r.who}: ${r.text}${r.loud ? '  [x2.5 LOUD]' : ''}`);
  }
  const lab = rows.filter((r) => r.want);
  const acc = (k) => lab.filter((r) => r[k] === r.want).length;
  const emo = lab.filter((r) => r.want !== 'neutral');
  S.tone = { labelled: lab.length, raw: acc('raw'), shown: acc('shown'), emotive: emo.length, emotiveRaw: emo.filter((r) => r.raw === r.want).length, emotiveShown: emo.filter((r) => r.shown === r.want).length };
  const rates = {};
  for (const f of partFinals) if (f.prosody) { const k = `${f.name}:${f.prosody.rate}`; rates[k] = (rates[k] ?? 0) + 1; }
  S.tone.prosodyRates = rates;
  const loud = {};
  for (const f of partFinals) if (f.prosody) { const k = `${f.name}:${f.prosody.loud}`; loud[k] = (loud[k] ?? 0) + 1; }
  S.tone.prosodyLoud = loud;
}

// ---------- voice id (--enroll): does voiceName match the script speaker of each final? ----------
S.voiceReport = null;
if (ENROLL) {
  const rows = [];
  // Expected speaker = the script line sharing >= half the final's words that overlaps it most in time (host socket and
  // Deepgram t=0 = the first streamed chunk = script t=0; phone lines are rebased onto the host clock). Timing breaks
  // ties for one-word fragments ("I'll") that several lines contain.
  const overlapMs = (v, l) => Math.min(v.tEnd, l.start + l.dur) - Math.max(v.tStart, l.start);
  for (const v of S.voice ?? []) {
    if (SINGLE === v.phone) continue; // single-mic: host lines; --bleed: phone lines
    const cands = lines.filter((l) => frac(v.tokens, toks(l.text)) >= 0.5);
    const best = cands.sort((a, b) => overlapMs(v, b) - overlapMs(v, a))[0];
    if (!best) continue; // noise / fragment not traceable to one script line
    rows.push({ ...v, want: names[best.speaker], got: SINGLE ? v.voiceName : v.name });
  }
  const ok = rows.filter((r) => r.got === r.want).length;
  // Interims, first 1.5 s of each line: runs that START with the line (tStart >= line start - 0.3 s) and end within its
  // first 1.5 s, sharing >= half their words with it. Did the name show up right with the first words?
  const early = { lines: 0, firstRight: 0, interims: 0, right: 0 };
  // Overlapped lines (start before the previous one ended): a final named for the line's speaker holding >= 50% of the
  // line's words with >= 60% of its own words from that line = split off correctly.
  const split = { overlapped: 0, right: 0, misses: [] };
  if (SINGLE) {
    for (const [k, l] of lines.entries()) {
      const lt = toks(l.text);
      const iv = (S.interimsV ?? []).filter((v) => v.tStart >= l.start - 300 && v.tEnd <= l.start + 1500 && v.tEnd > l.start && frac(v.tokens, lt) >= 0.5);
      if (iv.length) {
        early.lines++; early.interims += iv.length;
        if (iv[0].voiceName === names[l.speaker]) early.firstRight++;
        early.right += iv.filter((v) => v.voiceName === names[l.speaker]).length;
      }
      const prev = lines[k - 1];
      if (!prev || l.start >= prev.start + prev.dur) continue;
      split.overlapped++;
      const good = (S.voice ?? []).some((v) => !v.phone && v.voiceName === names[l.speaker] && frac(lt, v.tokens) >= 0.5 && frac(v.tokens, lt) >= 0.6);
      if (good) split.right++; else split.misses.push(`${names[l.speaker]}: ${l.text}`);
    }
  }
  const health = await fetch(`${http}/api/health`).then((r) => r.json()).catch(() => ({}));
  S.voiceReport = { mode: SINGLE ? 'single-mic' : 'phones+bleed', finals: rows.length, correct: ok, pct: rows.length ? Math.round((ok / rows.length) * 1000) / 10 : 0,
    early, split: OVERLAP ? split : null,
    unnamed: rows.filter((r) => !r.got).length, scored: rows.filter((r) => r.voiceScore != null).length, server: health.room?.voice ?? null,
    wrong: rows.filter((r) => r.got !== r.want).map((r) => `want ${r.want} got ${r.got ?? '-'}${r.voiceScore != null ? `(${r.voiceScore})` : ''}: ${r.text}`) };
}

// ---------- summary ----------
const stats = (arr) => { const v = arr.filter((x) => typeof x === 'number').sort((a, b) => a - b); return v.length ? { n: v.length, p50: v[Math.floor(v.length / 2)], max: v[v.length - 1] } : { n: 0 }; };
const summary = {
  scenario: scenArg, overlap: OVERLAP, host: HOST, noise: !!noise, scheduledOverlaps: overlaps,
  finals: S.finals, pace: S.pace, paceOverlapMsgs: S.paceOverlap, tableOverlapMsgs: S.tableOverlap,
  hostMicFinals: S.hostFinals, hostMicDupsCaughtByGuard: S.hostFinalsDup, hostMicUnique: S.hostFinalsUnique,
  merged: S.merged, missed: S.missed, statusErrors: S.statusErrors, unexpectedCloses: S.closes.filter((c) => !/1000|1005/.test(c)),
  http: S.http, gate: stats(S.gate.map((g) => g.ms)), gateSources: S.gate.reduce((a, g) => ({ ...a, [g.source]: (a[g.source] ?? 0) + 1 }), {}),
  state: stats(S.state.map((s) => s.ms)), stateDegraded: S.state.filter((s) => s.degraded || s.status !== 200).length,
  stateMaxWindow: Math.max(0, ...S.state.map((s) => s.win)), catchup: S.catchup, ledgerItems: S.ledgerItems, say: S.say,
  name: S.name, voice: S.voiceReport, crossDup: S.crossDup, fragmented: S.fragmented, tone: S.tone, moods: S.moods,
};
console.log('\n===== SUMMARY =====');
console.log(`finals per speaker: ${Object.entries(S.finals).map(([k, v]) => `${k}=${v}`).join(' ')}`);
console.log(`pace by level: ${Object.entries(S.pace).map(([k, p]) => `${k}{ok:${p.ok} fast:${p.fast} too_fast:${p.too_fast} max:${p.maxWpm}wpm}`).join(' ')}`);
console.log(`overlap: scheduled=${overlaps} pace-msgs-with-overlap=${S.paceOverlap} table-msgs-with-overlap=${S.tableOverlap}`);
if (HOST) console.log(`host mic: finals=${S.hostFinals} caught-as-duplicate=${S.hostFinalsDup} would-show-as-extra-line=${S.hostFinalsUnique.length}`);
console.log(`merged finals: ${S.merged.length}${S.merged.length ? '\n  ' + S.merged.join('\n  ') : ''}`);
console.log(`cross-speaker copies (wrong name): ${S.crossDup.length}${S.crossDup.length ? '\n  ' + S.crossDup.join('\n  ') : ''}`);
console.log(`fragmented script lines: ${S.fragmented.length}${S.fragmented.length ? '\n  ' + S.fragmented.join('\n  ') : ''}`);
console.log(`name "${me.name}": ${S.name.hit}/${S.name.lines} spelled right${S.name.got.length ? ` (${S.name.got.join(' | ')})` : ''}`);
if (S.tone) console.log(`tone: raw ${S.tone.raw}/${S.tone.labelled} smoothed ${S.tone.shown}/${S.tone.labelled}; emotive-only raw ${S.tone.emotiveRaw}/${S.tone.emotive} smoothed ${S.tone.emotiveShown}/${S.tone.emotive}; prosody rate ${JSON.stringify(S.tone.prosodyRates)} loud ${JSON.stringify(S.tone.prosodyLoud)}`);
console.log(`missed script lines: ${S.missed.length}${S.missed.length ? '\n  ' + S.missed.join('\n  ') : ''}`);
console.log(`status errors: ${S.statusErrors.length ? S.statusErrors.join('; ') : 'none'}; unexpected closes: ${summary.unexpectedCloses.join('; ') || 'none'}`);
if (DRIVE) {
  console.log(`http: ${JSON.stringify(S.http)}`);
  console.log(`gate ms: ${JSON.stringify(summary.gate)} ${JSON.stringify(summary.gateSources)}`);
  console.log(`state ms: ${JSON.stringify(summary.state)} degraded=${summary.stateDegraded} maxWindow=${summary.stateMaxWindow} ledger=${S.ledgerItems}`);
  console.log(`catchup: ${JSON.stringify(S.catchup)}`);
}
if (S.voiceReport) {
  const v = S.voiceReport;
  console.log(`voice id (${v.mode}): ${v.correct}/${v.finals} finals named right (${v.pct}%), unnamed=${v.unnamed}, identified-this-line=${v.scored}; server ${JSON.stringify(v.server)}`);
  if (SINGLE) console.log(`  interims, first 1.5 s of a line: first interim named right ${v.early.firstRight}/${v.early.lines} lines; all early interims ${v.early.right}/${v.early.interims}`);
  if (v.split) console.log(`  overlapped lines split off with the right name: ${v.split.right}/${v.split.overlapped}${v.split.misses.length ? '\n    miss ' + v.split.misses.join('\n    miss ') : ''}`);
  if (!SINGLE) console.log(`  phone finals re-named by voice (owner != confident voice): ${v.server?.phoneRenamed ?? '?'}; cross-speaker copies left: ${S.crossDup.length}`);
  if (v.wrong.length) console.log('  ' + v.wrong.join('\n  '));
}
if (S.say) console.log(`say: delivered=${S.say.delivered} received-by=${S.say.got.join(',') || 'none'}`);
if (flags.json) writeFileSync(flags.json, JSON.stringify(summary, null, 2));
process.exit(0);
