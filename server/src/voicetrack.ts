// Single-phone mode, live: who is speaking on ONE mic, by voice, while they speak.
//
// Per audio socket:
//   PcmRing      last 30 s of the PCM sent to Deepgram on one monotonic clock (ring seconds). A Deepgram stream's word
//                time t lives at ring position gBase + t (gBase = ring.totalSec when that stream opened).
//   windows      host only: every VOICE_HOP_S of VOICED audio, embed the last VOICE_WIN_S and identify it (instant names
//                for interims; ~5-10 ms each, skipped after a slow one).
//   changes      host only: two consecutive windows unlike the current speaker's (cosine < CHANGE_COS) AND naming someone
//                else = a speaker change. The Coalescer splits its held words there (the fingerprint decides turns;
//                Deepgram's diarization ids are only a hint).
//   stamp()      voiceName/voiceScore for a transcript message: finals = identify the whole segment (+ vote the Deepgram
//                id -> name map); else window vote; else the remembered Deepgram-id mapping.
import { assign, cosine, embed, identify, identifyEmbedding, resolve, roster, tableThreshold } from './voiceid.ts';
import type { AsrMessage } from '../../shared/types';

type TranscriptMsg = Extract<AsrMessage, { type: 'transcript' }>;
const LOG = () => process.env.VOICEID_LOG === '1';

/** Last ~30 s of PCM16 (16 kHz mono), addressable by ring seconds. */
export class PcmRing {
  private chunks: { at: number; b: Buffer }[] = []; // at = sample index of the chunk's first sample
  private total = 0;                                 // samples pushed so far
  constructor(private keepSec = 30, private rate = 16_000) {}
  get totalSec(): number { return this.total / this.rate; }
  push(b: Buffer): void {
    const n = b.length >> 1;
    if (!n) return;
    this.chunks.push({ at: this.total, b: b.length & 1 ? b.subarray(0, b.length - 1) : b });
    this.total += n;
    const keepFrom = this.total - this.keepSec * this.rate;
    while (this.chunks.length && this.chunks[0].at + (this.chunks[0].b.length >> 1) <= keepFrom) this.chunks.shift();
  }
  /** PCM16 between two ring positions (seconds), clipped to what is still held. */
  slice(fromSec: number, toSec: number): Buffer {
    const a = Math.max(0, Math.floor(fromSec * this.rate)), z = Math.min(this.total, Math.ceil(toSec * this.rate));
    if (z <= a) return Buffer.alloc(0);
    const parts: Buffer[] = [];
    for (const c of this.chunks) {
      const n = c.b.length >> 1, s = c.at, e = c.at + n;
      if (e <= a || s >= z) continue;
      parts.push(c.b.subarray((Math.max(a, s) - s) * 2, (Math.min(z, e) - s) * 2));
    }
    return parts.length === 1 ? parts[0] : Buffer.concat(parts);
  }
}

// ---------- tunables ----------
export const VOICE_MIN_SEG_MS = 800;   // finals shorter than this: no own embedding (window vote / remembered mapping)
export const VOICE_PAD_MS = 150;       // slice this much either side of the words (Deepgram word edges are tight)
export const VOICE_MAX_SEG_MS = 4_000; // embedding cost grows with length: a long final's middle 4 s (p95 ~33 ms)
export const VOICE_SHORT_MIN_SCORE = 0.7; // short line read from a centred 800 ms window: name it only this confident
export const VOICE_WIN_S = 1.2;        // sliding window length…
export const VOICE_HOP_S = 0.4;        // …every this much voiced audio
const WIN_SLACK = 0.05;                // windows are short: accept threshold - 0.05 (the margin rule still applies)
const WIN_SLOW_MS = 40;                // a window slower than this skips the next one (CPU cap)
export const CHANGE_COS = 0.5;         // window vs current speaker's window below this = "someone else"
const CHANGE_BACK_S = 0.7;             // change time ≈ end of the first unlike window - this; it lies in [end - 1.2, end - 0.2]
const CUT_SILENCE_MS = 150;            // inside that range, cut at the longest VAD silence between words if >= this…
const SNAP_S = 0.6;                    // …else at the word boundary nearest the estimate (if this close)
const GLITCH_WORDS = 2, GLITCH_S = 0.8; // inside one voice, a Deepgram-speaker run this short is a diarization glitch
const INTERIM_AHEAD_S = 0.8;           // an interim's speaker usually keeps talking: look this far past its last word

export interface VoiceHit { name: string; score: number; ms: number; widened?: boolean }
/** PCM16 for [startSec, endSec] of one Deepgram stream's word clock. */
export type StreamSlicer = (startSec: number, endSec: number) => Buffer;

/**
 * Identify the speaker of [tStartMs, tEndMs] (a Deepgram stream's clock). null: unknown / low score / too short.
 * widenShort: a line shorter than VOICE_MIN_SEG_MS is read from a VOICE_MIN_SEG_MS window centred on it instead
 * (result has widened=true; callers should demand VOICE_SHORT_MIN_SCORE).
 */
export function voiceOf(table: string, slice: StreamSlicer, tStartMs: number, tEndMs: number, widenShort = false): VoiceHit | null {
  let widened = false;
  if (tEndMs - tStartMs < VOICE_MIN_SEG_MS) {
    if (!widenShort) return null;
    const mid = (tStartMs + tEndMs) / 2, half = VOICE_MIN_SEG_MS / 2 + 1;
    tStartMs = mid - half; tEndMs = mid + half; widened = true;
  }
  let a = Math.max(0, (tStartMs - VOICE_PAD_MS) / 1000), z = (tEndMs + VOICE_PAD_MS) / 1000;
  if ((z - a) * 1000 > VOICE_MAX_SEG_MS) { const mid = (a + z) / 2; a = mid - VOICE_MAX_SEG_MS / 2000; z = mid + VOICE_MAX_SEG_MS / 2000; }
  const t0 = performance.now();
  try {
    const r = identify(table, slice(a, z), { minMs: VOICE_MIN_SEG_MS });
    const ms = Math.round(performance.now() - t0);
    if (LOG()) console.log(`[voiceid] seg ${Math.round(tStartMs)}-${Math.round(tEndMs)}ms -> ${r.name ?? `null(${r.reason})`} ${r.score} 2nd=${r.second?.name ?? '-'}:${r.second?.score ?? '-'} ${ms}ms`);
    return r.name ? { name: r.name, score: r.score, ms, ...(widened ? { widened } : {}) } : null;
  } catch (e) {
    console.warn(`[voiceid] identify failed: ${(e as Error).message}`);
    return null;
  }
}

/** Words as the Coalescer holds them (asr.ts DgWord): times on their stream's clock + that stream's ring base. */
export interface TimedWord { start: number; end: number; gBase?: number; speaker?: number }
interface Win { s: number; e: number; name: string | null; score: number }
export interface VoiceChange { at: number; lo: number; hi: number; from: string | null; to: string }
export interface VoiceStats { hostFinals: number; hostIded: number; hostRemembered: number; maxMs: number; windows: number; windowMs: number; changes: number; splits: number }

export class VoiceTrack {
  readonly ring = new PcmRing(30);
  /** Current Deepgram stream: its t=0 on the ring and its generation (diarization ids restart per stream). */
  base = 0;
  gen = 0;
  private wins: Win[] = [];
  private lastWinAt = -Infinity;
  private busy = false;
  private skipNext = false;
  private anchor: Float32Array | null = null;
  private anchorName: string | null = null;
  private low = 0;
  private firstLowEnd = 0;
  readonly changes: VoiceChange[] = [];
  private sticky = new Map<string, string>(); // interim run (gen:tStart) -> name shown, so interims don't flicker

  /** Longest VAD silence (ms) in [fromS, toS] of the CURRENT stream's clock (asr.ts SilenceTrack). */
  silence?: (fromS: number, toS: number) => number;

  /** live: run sliding windows + change detection (the host mic). Phones only need the ring. */
  constructor(private table: string, private live: boolean, private stats?: VoiceStats) {}

  get active(): boolean { return roster(this.table).length > 0; }

  newStream(gen: number): void { this.base = this.ring.totalSec; this.gen = gen; }

  /** PCM16 for [startSec, endSec] of the CURRENT Deepgram stream's word clock. */
  sliceHostPcm = (startSec: number, endSec: number): Buffer => this.ring.slice(this.base + startSec, this.base + endSec);
  slicer(gBase?: number): StreamSlicer {
    if (gBase == null) return this.sliceHostPcm;
    return (a, z) => this.ring.slice(gBase + a, gBase + z);
  }

  /** One chunk sent to Deepgram. */
  push(buf: Buffer, voiced: boolean): void {
    this.ring.push(buf);
    if (this.live && voiced) this.window();
  }

  private window(): void {
    const now = this.ring.totalSec;
    if (now - this.lastWinAt < VOICE_HOP_S || now < VOICE_WIN_S || this.busy || !this.active) return;
    this.lastWinAt = now;
    if (this.skipNext) { this.skipNext = false; return; }
    this.busy = true;
    const t0 = performance.now();
    try {
      const e = embed(this.ring.slice(now - VOICE_WIN_S, now));
      const r = identifyEmbedding(this.table, e, { threshold: tableThreshold(this.table) - WIN_SLACK });
      this.wins.push({ s: now - VOICE_WIN_S, e: now, name: r.name, score: r.score });
      while (this.wins.length && now - this.wins[0].e > 30) this.wins.shift();
      this.detectChange(e, r.name, now);
    } catch { /* mostly silence: too little voiced audio for an embedding */ }
    finally {
      this.busy = false;
      const ms = performance.now() - t0;
      if (this.stats) { this.stats.windows++; this.stats.windowMs = Math.max(this.stats.windowMs, Math.round(ms)); }
      if (ms > WIN_SLOW_MS) this.skipNext = true;
    }
  }

  private detectChange(e: Float32Array, name: string | null, now: number): void {
    if (!this.anchor) { this.anchor = e; this.anchorName = name; return; }
    const c = cosine(this.anchor, e);
    if (c >= CHANGE_COS) { this.low = 0; this.anchor = e; if (name) this.anchorName = name; return; }
    if (++this.low === 1) this.firstLowEnd = now;
    if (this.low >= 2 && name && name !== this.anchorName) {
      const at = this.firstLowEnd - CHANGE_BACK_S;
      this.changes.push({ at, lo: this.firstLowEnd - VOICE_WIN_S, hi: this.firstLowEnd - 0.2, from: this.anchorName, to: name });
      while (this.changes.length && now - this.changes[0].at > 30) this.changes.shift();
      if (this.stats) this.stats.changes++;
      if (LOG()) console.log(`[voiceid] change ${this.anchorName ?? '?'} -> ${name} at ${(at - this.base).toFixed(2)}s (cos ${c.toFixed(2)})`);
      this.anchor = e; this.anchorName = name; this.low = 0;
    } else if (this.low >= 3) { this.anchor = e; if (name) this.anchorName = name; this.low = 0; } // drifted, same/unknown name
  }

  /**
   * Split a run of words at voice changes (nearest word boundary within SNAP_S). The Coalescer flushes all but the last
   * part as finals at once, so a turn taken over mid-run ends as its own line with the old name.
   */
  split = <W extends TimedWord>(words: W[]): W[][] => {
    if (words.length < 2 || !this.active) return [words];
    const g = (w: W, t: number) => (w.gBase ?? this.base) + t;
    const first = g(words[0], words[0].start), last = g(words[words.length - 1], words[words.length - 1].end);
    const cuts = new Set<number>();
    for (const c of this.changes) {
      if (c.hi <= first || c.lo >= last) continue;
      let best = -1, bd = SNAP_S, bestSil = CUT_SILENCE_MS - 1;
      for (let i = 1; i < words.length; i++) {
        const b = (g(words[i - 1], words[i - 1].end) + g(words[i], words[i].start)) / 2;
        // A real turn change usually sits in a pause: prefer the longest one inside the change's plausible range.
        const cur = (words[i].gBase ?? this.base) === this.base && (words[i - 1].gBase ?? this.base) === this.base;
        const sil = cur && this.silence && b >= c.lo && b <= c.hi ? this.silence(words[i - 1].start, words[i].start + 0.05) : 0;
        if (sil > bestSil) { bestSil = sil; best = i; bd = -1; continue; }
        if (bd < 0) continue; // a pause already won
        const d = Math.abs(b - c.at);
        if (d <= bd) { bd = d; best = i; }
      }
      if (best > 0) cuts.add(best);
    }
    const out: W[][] = [];
    let cur: W[] = [];
    words.forEach((w, i) => { if (cuts.has(i) && cur.length) { out.push(cur); cur = []; } cur.push(w); });
    if (cur.length) out.push(cur);
    return out.map((p) => this.smoothGlitches(p));
  };
  /** Within one voice, a 1-2 word Deepgram-speaker run ("We'll" under the previous speaker's id) joins its neighbour. */
  private smoothGlitches<W extends TimedWord>(part: W[]): W[] {
    const runs: { s: number; e: number; spk: number | undefined }[] = [];
    part.forEach((w, i) => { const r = runs[runs.length - 1]; if (r && r.spk === w.speaker) r.e = i; else runs.push({ s: i, e: i, spk: w.speaker }); });
    if (runs.length < 2) return part;
    const out = part.slice();
    runs.forEach((r, k) => {
      const n = r.e - r.s + 1, dur = part[r.e].end - part[r.s].start;
      if (n > GLITCH_WORDS || dur >= GLITCH_S) return;
      const nb = runs[k + 1] ?? runs[k - 1];
      if (!nb || nb.e - nb.s + 1 <= n) return;
      for (let i = r.s; i <= r.e; i++) out[i] = { ...out[i], speaker: nb.spk };
    });
    return out;
  }
  countSplit(n: number): void { if (this.stats) this.stats.splits += n; }

  /** Weighted vote of the sliding windows over [a, b] (ring s): windows mostly inside the span, by overlap. */
  private windowVote(a: number, b: number): { name: string; score: number; n: number } | null {
    const span = b - a;
    const need = Math.min(0.6 * VOICE_WIN_S, 0.8 * span);
    const tally = new Map<string, { w: number; s: number; n: number }>();
    for (const w of this.wins) {
      if (!w.name) continue;
      const ov = Math.min(w.e, b) - Math.max(w.s, a);
      if (ov < need || ov <= 0) continue;
      const t = tally.get(w.name) ?? { w: 0, s: 0, n: 0 };
      t.w += ov; t.s += w.score * ov; t.n++;
      tally.set(w.name, t);
    }
    let best: { name: string; score: number; n: number } | null = null, bw = 0;
    for (const [name, t] of tally) if (t.w > bw) { bw = t.w; best = { name, score: Math.round((t.s / t.w) * 1000) / 1000, n: t.n }; }
    return best;
  }

  /** voiceName / voiceScore for a host transcript (see file header). */
  stamp(m: TranscriptMsg, src?: { gBase: number; gen: number }): TranscriptMsg {
    if (!m.text.trim() || !this.active) return m;
    const gBase = src?.gBase ?? this.base, gen = src?.gen ?? this.gen;
    const key = m.speaker >= 0 ? `${gen}:${m.speaker}` : null;
    const a = gBase + m.tStart / 1000, b = gBase + m.tEnd / 1000;
    const runKey = `${gen}:${m.tStart}`;
    if (!m.final) {
      const w = this.windowVote(a, b + INTERIM_AHEAD_S);
      const shown = this.sticky.get(runKey);
      // Keep the name already on this run unless >= 2 windows now agree on someone else.
      const name = shown && (!w || w.name === shown || w.n < 2) ? shown : w?.name ?? (key ? resolve(this.table, key) : null);
      if (!name) return m;
      this.sticky.set(runKey, name);
      if (this.sticky.size > 200) this.sticky.delete(this.sticky.keys().next().value!);
      return { ...m, voiceName: name, ...(w?.name === name ? { voiceScore: w.score } : {}) };
    }
    this.sticky.delete(runKey);
    const vs = this.stats;
    if (vs) vs.hostFinals++;
    const slice = this.slicer(gBase);
    const hit = voiceOf(this.table, slice, m.tStart, m.tEnd);
    if (hit) {
      if (vs) { vs.hostIded++; vs.maxMs = Math.max(vs.maxMs, hit.ms); }
      if (key) assign(this.table, key, hit.name);
      return { ...m, voiceName: hit.name, voiceScore: hit.score };
    }
    const w = this.windowVote(a, b);
    if (w) { if (vs) vs.hostIded++; return { ...m, voiceName: w.name, voiceScore: w.score }; }
    const n = key ? resolve(this.table, key) : null;
    if (n) { if (vs) vs.hostRemembered++; return { ...m, voiceName: n }; }
    const wide = m.tEnd - m.tStart < VOICE_MIN_SEG_MS ? voiceOf(this.table, slice, m.tStart, m.tEnd, true) : null;
    if (wide && wide.score >= VOICE_SHORT_MIN_SCORE) { if (vs) vs.hostIded++; return { ...m, voiceName: wide.name, voiceScore: wide.score }; }
    return m;
  }
}
