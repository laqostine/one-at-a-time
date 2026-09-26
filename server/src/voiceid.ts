// Single-phone mode: name each sentence by VOICE, not by which phone it came from.
// CPU speaker embeddings via sherpa-onnx-node (ONNX Runtime, no Python). In-memory only, per table.
//
//   embed(pcm16)                          -> L2-normalised speaker embedding
//   enroll(token, name, pcm16)            -> keeps last 3 samples per name, centroid = mean
//   identify(token, pcm16, {minMs})       -> {name|null, score, second}  (cosine vs centroids, threshold + margin)
//   assign(token, dgSpeaker, name)        -> hysteresis map Deepgram speaker id -> name (2 votes to switch)
//   clearTable(token)                     -> forget everything for that table
//
// Model: server/models/<VOICEID_MODEL> (default nemo_en_titanet_small.onnx, 40 MB; alt 3dspeaker_speech_eres2net_sv_en_voxceleb_16k.onnx, 26 MB).
// Both from https://github.com/k2-fsa/sherpa-onnx/releases/tag/speaker-recongition-models (fetch: server/models/fetch.sh).
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ---------- tunables (see tools/voiceid-test.mjs for how these were chosen) ----------
export const DEFAULT_THRESHOLD = Number(process.env.VOICEID_THRESHOLD) || 0.62;
export const DEFAULT_MARGIN = Number(process.env.VOICEID_MARGIN) || 0.1;
/** A stranger must not pass as the closest enrolled voice: the threshold sits at least this far above the closest pair. */
export const CROSS_GAP = 0.1;
/** Real voices on a phone mic score 0.3-0.6 against their own print (TitaNet-small); a stranger scores about the same
 *  against someone else's. With >= 2 voices the decision is RELATIVE: best clearly ahead of the runner-up and above a
 *  low floor. With 1 voice only the absolute threshold can be used. */
export const REL_FLOOR = Number(process.env.VOICEID_REL_FLOOR) || 0.35;
export const REL_MARGIN = Number(process.env.VOICEID_REL_MARGIN) || 0.12;
/** A confidently named live line becomes a new sample: the print adapts to the room and the mic within a minute. */
export const ADAPT_MIN_SCORE = Number(process.env.VOICEID_ADAPT_MIN) || 0.5;
export const DEFAULT_MIN_MS = 800;
export const MAX_SAMPLES_PER_NAME = 8;
export const SWITCH_VOTES = 2;
export const DEFAULT_MODEL = 'nemo_en_titanet_small.onnx';

// ---------- native extractor (lazy) ----------
interface SherpaStream { acceptWaveform(o: { samples: Float32Array; sampleRate: number }): void; inputFinished(): void }
interface SherpaExtractor { dim: number; createStream(): SherpaStream; isReady(s: SherpaStream): boolean; compute(s: SherpaStream, ext?: boolean): Float32Array }
interface SherpaModule { SpeakerEmbeddingExtractor: new (cfg: { model: string; numThreads?: number; debug?: boolean; provider?: string }) => SherpaExtractor }

let extractor: SherpaExtractor | null = null;
let loadError: string | null = null;

export function modelPath(): string {
  const name = process.env.VOICEID_MODEL || DEFAULT_MODEL;
  return name.includes('/') ? name : fileURLToPath(new URL(`../models/${name}`, import.meta.url));
}

function getExtractor(): SherpaExtractor {
  if (extractor) return extractor;
  if (loadError) throw new Error(loadError);
  try {
    const path = modelPath();
    if (!existsSync(path)) throw new Error(`voiceid model missing: ${path} (see README "One phone, many voices")`);
    const req = createRequire(import.meta.url);
    const sherpa = req('sherpa-onnx-node') as SherpaModule;
    extractor = new sherpa.SpeakerEmbeddingExtractor({ model: path, numThreads: Number(process.env.VOICEID_THREADS) || 2, debug: false, provider: 'cpu' });
    return extractor;
  } catch (e) {
    loadError = (e as Error).message;
    throw e;
  }
}

/** True when the model loads; never throws. */
export function voiceIdAvailable(): boolean {
  try { getExtractor(); return true; } catch { return false; }
}
export function voiceIdError(): string | null { return loadError; }

// ---------- audio helpers ----------
export function pcmMs(pcm16: Buffer, sampleRate = 16000): number { return (pcm16.length / 2 / sampleRate) * 1000; }

function toFloat(pcm16: Buffer): Float32Array {
  const n = pcm16.length >> 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = pcm16.readInt16LE(i * 2) / 32768;
  return out;
}

/** Drop 20 ms frames that are much quieter than the loud part of the clip (room hiss, gaps between words). */
function keepVoiced(x: Float32Array, sampleRate: number): Float32Array {
  const f = Math.round(sampleRate * 0.02);
  const frames = Math.floor(x.length / f);
  if (frames < 10) return x;
  const rms = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let j = i * f; j < (i + 1) * f; j++) s += x[j] * x[j];
    rms[i] = Math.sqrt(s / f);
  }
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const loud = sorted[Math.floor(frames * 0.9)];
  const gate = Math.max(0.004, loud * 0.1);
  const keep: number[] = [];
  for (let i = 0; i < frames; i++) if (rms[i] >= gate) keep.push(i);
  if (keep.length * f < sampleRate * 0.5) return x; // too little left: use it all
  const out = new Float32Array(keep.length * f);
  keep.forEach((fi, k) => out.set(x.subarray(fi * f, (fi + 1) * f), k * f));
  return out;
}

function normalize(v: Float32Array): Float32Array {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / n;
  return out;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na * nb) || 1);
}

/** Speaker embedding of a mono PCM16 LE clip. L2-normalised copy (safe to keep). Throws if the model can't load. */
export function embed(pcm16: Buffer, sampleRate = 16000): Float32Array {
  const ex = getExtractor();
  const s = ex.createStream();
  s.acceptWaveform({ samples: keepVoiced(toFloat(pcm16), sampleRate), sampleRate });
  s.inputFinished();
  if (!ex.isReady(s)) throw new Error('voiceid: clip too short for an embedding');
  return normalize(ex.compute(s, false));
}

// ---------- per-table state ----------
/** selfSims: same-person similarities seen at enrollment (half-clip vs half-clip, and sample vs sample). */
interface Voice { samples: Float32Array[]; centroid: Float32Array; selfSims: number[] }
interface DgMap { name: string; votes: number; pending: string | null; pendingVotes: number }
interface Table { voices: Map<string, Voice>; dg: Map<string, DgMap>; calib: Calibration | null }
/** Per-table threshold: midway between the least self-similar enrolled voice and the most similar pair of voices. */
export interface Calibration { threshold: number; self: number | null; cross: number | null }
export const CALIB_MIN = 0.55, CALIB_MAX = 0.8;
const tables = new Map<string, Table>();

function table(token: string): Table {
  let t = tables.get(token);
  if (!t) { t = { voices: new Map(), dg: new Map(), calib: null }; tables.set(token, t); }
  return t;
}

function centroidOf(samples: Float32Array[]): Float32Array {
  const c = new Float32Array(samples[0].length);
  for (const s of samples) for (let i = 0; i < c.length; i++) c[i] += s[i];
  return normalize(c);
}

export interface EnrollResult { name: string; samples: number; selfScore: number | null; ms: number }

/** Add a voice sample for `name` (keeps the newest 3). `selfScore` = similarity of this clip to the name's previous centroid. */
export function enroll(tableToken: string, name: string, pcm16: Buffer, sampleRate = 16000): EnrollResult {
  const clean = name.trim().slice(0, 40);
  if (!clean) throw new Error('voiceid: name required');
  const e = embed(pcm16, sampleRate);
  // Same voice, two halves of the clip: how similar a person is to themself on THIS mic (feeds the table threshold).
  let half: number | undefined;
  try {
    const mid = (pcm16.length >> 2) << 1;
    half = cosine(embed(pcm16.subarray(0, mid), sampleRate), embed(pcm16.subarray(mid), sampleRate));
  } catch { /* clip too short to halve */ }
  return enrollEmbedding(tableToken, clean, e, pcmMs(pcm16, sampleRate), half);
}

function calibrate(t: Table): void {
  const vs = [...t.voices.values()];
  const selfs = vs.map((v) => (v.selfSims.length ? v.selfSims.reduce((a, x) => a + x, 0) / v.selfSims.length : null)).filter((x): x is number => x != null);
  const self = selfs.length ? Math.min(...selfs) : null;
  let cross: number | null = null;
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) cross = Math.max(cross ?? -1, cosine(vs[i].centroid, vs[j].centroid));
  let mid = self != null && cross != null ? (self + cross) / 2 : DEFAULT_THRESHOLD;
  if (cross != null) mid = Math.max(mid, cross + CROSS_GAP, DEFAULT_THRESHOLD);
  const r3 = (x: number | null) => (x == null ? null : Math.round(x * 1000) / 1000);
  t.calib = { threshold: r3(Math.min(CALIB_MAX, Math.max(CALIB_MIN, mid)))!, self: r3(self), cross: r3(cross) };
}

/** The table's calibrated threshold (DEFAULT_THRESHOLD until 2 voices are enrolled). VOICEID_THRESHOLD env pins it. */
export function tableThreshold(tableToken: string): number {
  if (process.env.VOICEID_THRESHOLD) return DEFAULT_THRESHOLD;
  return tables.get(tableToken)?.calib?.threshold ?? DEFAULT_THRESHOLD;
}
export function calibration(tableToken: string): Calibration {
  const c = tables.get(tableToken)?.calib;
  return { threshold: tableThreshold(tableToken), self: c?.self ?? null, cross: c?.cross ?? null };
}

/** Same as enroll() for a precomputed embedding (tests, reuse). */
export function enrollEmbedding(tableToken: string, name: string, e: Float32Array, ms = 0, halfSelf?: number): EnrollResult {
  const t = table(tableToken);
  const v = t.voices.get(name);
  const selfScore = v ? cosine(e, v.centroid) : null;
  const samples = [...(v?.samples ?? []), e].slice(-MAX_SAMPLES_PER_NAME);
  const selfSims = [...(v?.selfSims ?? []), ...(halfSelf != null ? [halfSelf] : []), ...(v ? v.samples.slice(-2).map((s) => cosine(s, e)) : [])].slice(-6);
  t.voices.set(name, { samples, centroid: centroidOf(samples), selfSims });
  calibrate(t);
  return { name, samples: samples.length, selfScore, ms };
}

/** Add a confidently identified live clip to `name`'s print (kept alongside the enrollment samples). */
export function adapt(tableToken: string, name: string, e: Float32Array): void {
  const t = tables.get(tableToken);
  const v = t?.voices.get(name);
  if (!t || !v) return;
  const samples = [...v.samples, e].slice(-MAX_SAMPLES_PER_NAME);
  t.voices.set(name, { ...v, samples, centroid: centroidOf(samples) });
  calibrate(t);
}

/** Voiced milliseconds in a clip (same gate as the embedding uses). */
export function voicedMs(pcm16: Buffer, sampleRate = 16000): number {
  const x = toFloat(pcm16);
  return Math.round((keepVoiced(x, sampleRate).length / sampleRate) * 1000);
}

export function removeVoice(tableToken: string, name: string): boolean {
  const t = tables.get(tableToken);
  if (!t) return false;
  for (const [k, m] of t.dg) if (m.name === name) t.dg.delete(k);
  const had = t.voices.delete(name);
  calibrate(t);
  return had;
}

export function roster(tableToken: string): { name: string; samples: number }[] {
  const t = tables.get(tableToken);
  return t ? [...t.voices].map(([name, v]) => ({ name, samples: v.samples.length })) : [];
}

export function clearTable(tableToken: string): void { tables.delete(tableToken); }

export interface IdentifyOpts { minMs?: number; threshold?: number; margin?: number; sampleRate?: number }
export interface IdentifyResult {
  name: string | null;
  score: number;
  second: { name: string; score: number } | null;
  /** why name is null: 'short' clip, 'empty' roster, 'low' score, 'close' runner-up */
  reason?: 'short' | 'empty' | 'low' | 'close';
  ms?: number;
}

/** Who is speaking in this clip? null unless best >= threshold AND best - runnerUp >= margin. */
export function identify(tableToken: string, pcm16: Buffer, opts: IdentifyOpts = {}): IdentifyResult {
  const sr = opts.sampleRate ?? 16000;
  const ms = pcmMs(pcm16, sr);
  if (ms < (opts.minMs ?? DEFAULT_MIN_MS)) return { name: null, score: 0, second: null, reason: 'short', ms };
  if (!tables.get(tableToken)?.voices.size) return { name: null, score: 0, second: null, reason: 'empty', ms };
  return { ...identifyEmbedding(tableToken, embed(pcm16, sr), opts), ms };
}

/** Score an embedding against the table's enrolled centroids. */
export function identifyEmbedding(tableToken: string, e: Float32Array, opts: IdentifyOpts = {}): IdentifyResult {
  const t = tables.get(tableToken);
  if (!t || t.voices.size === 0) return { name: null, score: 0, second: null, reason: 'empty' };
  const scored = [...t.voices].map(([name, v]) => ({ name, score: cosine(e, v.centroid) })).sort((a, b) => b.score - a.score);
  const [best, second = null] = scored;
  const threshold = opts.threshold ?? tableThreshold(tableToken);
  const margin = opts.margin ?? DEFAULT_MARGIN;
  const round = (x: number) => Math.round(x * 1000) / 1000;
  const sec = second ? { name: second.name, score: round(second.score) } : null;
  if (second) {
    // Relative rule (2+ voices): ahead of the runner-up by REL_MARGIN and above the floor, or above the absolute threshold.
    const gap = best.score - second.score;
    if (best.score >= threshold && gap >= margin) return { name: best.name, score: round(best.score), second: sec };
    if (best.score >= REL_FLOOR && gap >= REL_MARGIN) return { name: best.name, score: round(best.score), second: sec };
    return { name: null, score: round(best.score), second: sec, reason: gap < Math.min(margin, REL_MARGIN) ? 'close' : 'low' };
  }
  if (best.score < threshold) return { name: null, score: round(best.score), second: sec, reason: 'low' };
  return { name: best.name, score: round(best.score), second: sec };
}

// ---------- Deepgram diarization id -> enrolled name, with hysteresis ----------
/**
 * Feed one identify() vote for a Deepgram speaker id. First confident vote sets the mapping; a different name
 * must win SWITCH_VOTES times in a row to replace it (one bad clip can't relabel a person). null votes are ignored.
 * Returns the current mapped name (or null if none yet).
 */
export function assign(tableToken: string, diarizationId: number | string, name: string | null): string | null {
  const t = table(tableToken);
  const key = String(diarizationId);
  const m = t.dg.get(key);
  if (!name) return m?.name ?? null;
  if (!m) { t.dg.set(key, { name, votes: 1, pending: null, pendingVotes: 0 }); return name; }
  if (m.name === name) { m.votes++; m.pending = null; m.pendingVotes = 0; return name; }
  if (m.pending === name) m.pendingVotes++;
  else { m.pending = name; m.pendingVotes = 1; }
  if (m.pendingVotes >= SWITCH_VOTES) { t.dg.set(key, { name, votes: m.pendingVotes, pending: null, pendingVotes: 0 }); return name; }
  return m.name;
}

/** Current mapping for a Deepgram speaker id without voting. */
export function resolve(tableToken: string, diarizationId: number | string): string | null {
  return tables.get(tableToken)?.dg.get(String(diarizationId))?.name ?? null;
}

export function dgMappings(tableToken: string): Record<string, { name: string; votes: number }> {
  const t = tables.get(tableToken);
  const out: Record<string, { name: string; votes: number }> = {};
  if (t) for (const [k, m] of t.dg) out[k] = { name: m.name, votes: m.votes };
  return out;
}
