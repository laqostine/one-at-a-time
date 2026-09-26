#!/usr/bin/env node
// Offline test for server/src/voiceid.ts (single-phone mode: who is speaking, by voice).
// Makes TTS voices with macOS `say`, converts to 16 kHz PCM16 with ffmpeg, enrolls 3 voices, identifies 6 clips each,
// plus an unenrolled voice that should come back null. Prints a confusion matrix, accuracy, a threshold sweep, latency.
//
//   node tools/voiceid-test.mjs                 # default model
//   VOICEID_MODEL=3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx node tools/voiceid-test.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const serverReq = createRequire(join(root, 'server', 'package.json'));
const { tsImport } = await import(pathToFileURL(serverReq.resolve('tsx/esm/api')).href);
const V = await tsImport(pathToFileURL(join(root, 'server/src/voiceid.ts')).href, import.meta.url);

const work = join(tmpdir(), 'voiceid-test');
mkdirSync(work, { recursive: true });

const installed = execFileSync('say', ['-v', '?'], { encoding: 'utf8' }).split('\n').map((l) => l.split(/\s{2,}/)[0].trim());
const pick = (...names) => names.find((n) => installed.includes(n));

const ENROLLED = { Mom: 'Samantha', Dad: 'Daniel', Nonna: 'Karen' };
const STRANGER = pick('Alex', 'Fred', 'Moira'); // Alex is not installed on every Mac
const EXTRA_STRANGERS = ['Moira', 'Tessa', 'Rishi'].filter((n) => n !== STRANGER && installed.includes(n));

const ENROLL_LINES = {
  Mom: "Hi, I'm Mom. Sunday lunch is at one, and everyone brings a side dish, please don't forget the bread this time.",
  Dad: "Hi, I'm Dad. I'll handle the grill, but someone has to pick up the charcoal from the shop before noon.",
  Nonna: "Hello, I'm Nonna. I can't do evenings anymore, so let's keep it early and keep it simple for everyone.",
};
const TEST_LINES = [
  'Are you coming on Sunday or not?',
  'Pass me the salt, would you, love?',
  'I think the train leaves at half past seven.',
  'Nobody told me the dog had already eaten.',
  'We should really fix that window before winter.',
  'That film was far too long, honestly.',
];

function clip(voice, text, tag, seconds) {
  const aiff = join(work, `${tag}.aiff`);
  const pcm = join(work, `${tag}.pcm`);
  if (!existsSync(pcm)) {
    execFileSync('say', ['-v', voice, '-o', aiff, text]);
    const dur = seconds ? ['-af', `apad=whole_dur=${seconds}`, '-t', String(seconds)] : [];
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', aiff, ...dur, '-ac', '1', '-ar', '16000', '-f', 's16le', pcm]);
  }
  return readFileSync(pcm);
}

const TABLE = 'test-table';
const tokenOf = (s) => s.replace(/\W/g, '');
console.log(`model: ${V.modelPath()}`);
if (!V.voiceIdAvailable()) { console.error('voiceid unavailable:', V.voiceIdError()); process.exit(1); }

// warm-up (first compute pays for graph init)
V.embed(clip('Samantha', 'Warm up.', 'warm', 3));

// ---- enroll ----
for (const [name, voice] of Object.entries(ENROLLED)) {
  const r = V.enroll(TABLE, name, clip(voice, ENROLL_LINES[name], `enroll-${voice}`, 5));
  console.log(`enrolled ${name} (${voice}) samples=${r.samples} ${Math.round(r.ms)}ms`);
}

// ---- identify ----
const lat = [];
const results = []; // {truth, e}
function run(truth, voice) {
  TEST_LINES.forEach((line, i) => {
    const pcm = clip(voice, line, `test-${voice}-${i}`);
    const t0 = performance.now();
    const e = V.embed(pcm);
    const dt = performance.now() - t0;
    lat.push({ dt, ms: V.pcmMs(pcm) });
    results.push({ truth, voice, e });
  });
}
for (const [name, voice] of Object.entries(ENROLLED)) run(name, voice);
if (STRANGER) run('(none)', STRANGER);
for (const v of EXTRA_STRANGERS) run(`(none:${v})`, v);

function evaluate(threshold, margin) {
  const rows = {};
  let enrolledOk = 0, enrolledN = 0, strangerNull = 0, strangerN = 0, extraNull = 0, extraN = 0;
  for (const r of results) {
    const out = V.identifyEmbedding(TABLE, r.e, { threshold, margin });
    const got = out.name ?? 'null';
    const key = r.truth.startsWith('(none:') ? '(others)' : r.truth;
    (rows[key] ??= {})[got] = ((rows[key] ??= {})[got] ?? 0) + 1;
    if (r.truth === '(none)') { strangerN++; if (!out.name) strangerNull++; }
    else if (r.truth.startsWith('(none:')) { extraN++; if (!out.name) extraNull++; }
    else { enrolledN++; if (out.name === r.truth) enrolledOk++; }
    r.last = out;
  }
  return { rows, acc: enrolledOk / enrolledN, rej: strangerN ? strangerNull / strangerN : NaN, rejX: extraN ? extraNull / extraN : NaN };
}

const { rows, acc, rej, rejX } = evaluate(V.DEFAULT_THRESHOLD, V.DEFAULT_MARGIN);
const cols = [...Object.keys(ENROLLED), 'null'];
console.log(`\nconfusion (threshold ${V.DEFAULT_THRESHOLD}, margin ${V.DEFAULT_MARGIN}) rows=truth cols=predicted`);
console.log(['truth'.padEnd(16), ...cols.map((c) => c.padStart(6))].join(''));
for (const [truth, r] of Object.entries(rows)) {
  const label = truth === '(none)' ? `${STRANGER} (unenr.)` : truth === '(others)' ? `${EXTRA_STRANGERS.join('/')}` : truth;
  console.log([label.slice(0, 15).padEnd(16), ...cols.map((c) => String(r[c] ?? 0).padStart(6))].join(''));
}
console.log(`\nenrolled accuracy: ${(acc * 100).toFixed(1)}%   (target >= 95%)`);
console.log(`${STRANGER} -> null: ${(rej * 100).toFixed(1)}%   (target >= 80%)`);
if (EXTRA_STRANGERS.length) console.log(`other unenrolled (${EXTRA_STRANGERS.join(', ')}) -> null: ${(rejX * 100).toFixed(1)}%`);

console.log('\nper-clip scores (best / runner-up):');
evaluate(V.DEFAULT_THRESHOLD, V.DEFAULT_MARGIN);
for (const r of results) {
  const o = r.last;
  console.log(`  ${r.voice.padEnd(9)} -> ${(o.name ?? 'null').padEnd(6)} ${o.score.toFixed(3)}  2nd ${o.second?.name ?? '-'} ${o.second?.score?.toFixed(3) ?? ''} ${o.reason ?? ''}`);
}

console.log('\nthreshold sweep (margin 0.08): thr  acc  stranger-null  others-null');
for (const thr of [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]) {
  const s = evaluate(thr, V.DEFAULT_MARGIN);
  console.log(`  ${thr.toFixed(2)}  ${(s.acc * 100).toFixed(0).padStart(3)}%  ${(s.rej * 100).toFixed(0).padStart(3)}%  ${(s.rejX * 100).toFixed(0).padStart(3)}%`);
}

// ---- latency, normalised to a 3 s clip ----
const per3s = lat.map((l) => (l.dt / l.ms) * 3000).sort((a, b) => a - b);
const avgMs = lat.reduce((s, l) => s + l.ms, 0) / lat.length;
console.log(`\nembed latency: median ${per3s[per3s.length >> 1].toFixed(1)} ms per 3 s of audio (avg clip ${(avgMs / 1000).toFixed(2)} s, n=${lat.length})`);
// direct 3 s timing
const three = clip('Daniel', 'We should really fix that window before winter, before it gets cold again.', 'three', 3);
const t0 = performance.now();
for (let i = 0; i < 10; i++) V.embed(three);
console.log(`embed latency: ${((performance.now() - t0) / 10).toFixed(1)} ms for an exact 3.0 s clip (avg of 10)`);

// ---- hysteresis sanity ----
V.assign(TABLE, 0, 'Mom'); V.assign(TABLE, 0, 'Dad');
const afterOne = V.resolve(TABLE, 0);
V.assign(TABLE, 0, 'Dad');
console.log(`\nhysteresis: after 1 contrary vote -> ${afterOne}, after 2 -> ${V.resolve(TABLE, 0)} (expect Mom, Dad)`);
V.clearTable(TABLE);

const pass = acc >= 0.95 && (!STRANGER || rej >= 0.8);
console.log(pass ? '\nPASS' : '\nFAIL');
process.exit(pass ? 0 : 1);
