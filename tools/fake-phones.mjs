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
  if (['overlap', 'host', 'no-drive', 'tone-report'].includes(k)) flags[k] = true;
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
const HOST = !!flags.host;
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

// ---------- schedule ----------
const REPEAT = Math.max(1, Number(flags.repeat) || 1);
const script = scenario.lines.filter((l) => l.text).sort((a, b) => a.t - b.t);
const lines = Array.from({ length: REPEAT }, () => script).flat().map((l) => ({
  ...l, pcm: pcm16k(l.text, voiceList[l.speaker] ?? voiceList[0] ?? 'Alex', rateOf(l.speaker)),
}));
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
  gate: [], state: [], catchup: null, http: {}, say: null, merged: [], missed: [], ledgerItems: 0, provisionalLeft: 0,
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
  if (j.type !== 'transcript' || !j.final || !j.text.trim()) return;
  const at = Date.now();
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
    console.log(`  [host-mic ${el()}s] ${j.text}`);
  }
}
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
for (const id of speakerIds) socks[id] = await openPhone(id);
console.log(`room ${token}: ${speakerIds.length} phones + host${HOST ? ' (mixed mic)' : ' (monitor)'} connected; ${lines.length} lines, ${(totalMs / 1000).toFixed(0)} s, overlap=${OVERLAP} (${overlaps} overlapping pairs) noise=${!!noise} drive=${DRIVE}`);

// ---------- client simulation (/api/gate per final, /api/state every 8 s, /api/catchup at end) ----------
const me = { name: 'Bera', aliases: [] };
const utt = (f, i) => ({ id: `u${f.speaker}-${f.tStart}-${i}`, type: 'utterance', speaker: f.speaker, text: f.text, tStart: f.tStart, tEnd: f.tEnd, final: true, ...(f.threadId ? { threadId: f.threadId } : {}), ...(f.prosody ? { prosody: f.prosody } : {}) });
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
  console.log(`  [state ${el()}s] ${r.status} ${r.ms}ms win=${win.length} ledger=${(r.j.ledger ?? []).length}${r.j.degraded ? ' DEGRADED' : ''}`);
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
// ---------- fragmented: a script line whose words are spread over >= 2 finals, none holding >= 70% ----------
S.fragmented = [];
for (const l of lines) {
  const tk = toks(l.text);
  const mine = partFinals.filter((f) => f.name === names[l.speaker]);
  const covers = mine.map((f) => frac(tk, f.tokens)).filter((c) => c >= 0.2);
  if (covers.length >= 2 && Math.max(...covers) < 0.7) S.fragmented.push(`${names[l.speaker]}: "${l.text}"`);
}
// ---------- tone report: expected (scenario `tone`) vs the gate's raw + smoothed tone ----------
S.tone = null;
if (flags['tone-report']) {
  const rows = [];
  for (const l of lines) {
    const tk = toks(l.text);
    const best = partFinals.filter((f) => f.name === names[l.speaker]).map((f) => ({ f, c: frac(tk, f.tokens) })).sort((a, b) => b.c - a.c)[0];
    const f = best && best.c >= 0.5 ? best.f : null;
    rows.push({ who: names[l.speaker], text: l.text, want: l.tone ?? '', raw: f?.tone ?? '-', shown: f?.shown ?? '-', prosody: f?.prosody });
  }
  console.log('\n===== TONE REPORT =====');
  console.log('expected  raw       shown     prosody               line');
  for (const r of rows) {
    const p = r.prosody ? `${r.prosody.loud}/${r.prosody.rate}/+${r.prosody.pauseBeforeMs}` : '';
    console.log(`${(r.want || '.').padEnd(10)}${r.raw.padEnd(10)}${r.shown.padEnd(10)}${p.padEnd(22)}${r.who}: ${r.text}`);
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
  name: S.name, fragmented: S.fragmented, tone: S.tone,
};
console.log('\n===== SUMMARY =====');
console.log(`finals per speaker: ${Object.entries(S.finals).map(([k, v]) => `${k}=${v}`).join(' ')}`);
console.log(`pace by level: ${Object.entries(S.pace).map(([k, p]) => `${k}{ok:${p.ok} fast:${p.fast} too_fast:${p.too_fast} max:${p.maxWpm}wpm}`).join(' ')}`);
console.log(`overlap: scheduled=${overlaps} pace-msgs-with-overlap=${S.paceOverlap} table-msgs-with-overlap=${S.tableOverlap}`);
if (HOST) console.log(`host mic: finals=${S.hostFinals} caught-as-duplicate=${S.hostFinalsDup} would-show-as-extra-line=${S.hostFinalsUnique.length}`);
console.log(`merged finals: ${S.merged.length}${S.merged.length ? '\n  ' + S.merged.join('\n  ') : ''}`);
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
if (S.say) console.log(`say: delivered=${S.say.delivered} received-by=${S.say.got.join(',') || 'none'}`);
if (flags.json) writeFileSync(flags.json, JSON.stringify(summary, null, 2));
process.exit(0);
