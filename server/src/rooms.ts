// "Everyone joins" mode: one room per server boot, keyed by a token.
// Host sockets (the deaf user's device) receive their own diarized transcript PLUS every
// participant's transcript, tagged with the participant's name. Participants only send audio.
import { randomBytes } from 'node:crypto';
import { networkInterfaces, tmpdir } from 'node:os';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import type { AsrMessage, Participant, Prosody, RoomInfo } from '../../shared/types';
import { paceLevel } from '../../shared/types';
import { roster } from './voiceid.ts';

/** Forget the table's enrolled voices this long after the last host socket closed (a mic restart must not wipe them). */
const VOICEID_CLEAR_GRACE_MS = Number(process.env.VOICEID_CLEAR_GRACE_MS ?? 60_000);
/** A phone final's voice: which enrolled person spoke [t0, t1] (ms, that phone's Deepgram clock). */
const VOICE_OVERRIDE = Number(process.env.VOICEID_OVERRIDE) || 0.65; // a phone final is re-named only at/above this voice score
export type VoiceLookup = (t0: number, t1: number) => { name: string; score: number; widened?: boolean } | null;

/** Participant speaker ids start here so they never collide with Deepgram diarization ids (0..n). */
export const PARTICIPANT_ID_BASE = 100;
const SPEAKING_HOLD_MS = 1200;
const SPEAKING_RMS = 0.02; // PCM16 RMS (0..1) above which we call it voice

export type Role = 'host' | 'participant';

interface PSock { name: string; id: number; speakingUntil: number }

// ---- pace + overlap (see research: DHH caption comprehension drops above ~170 wpm; crosstalk is the top failure) ----
const PACE_WINDOW_MS = 20_000;   // rolling window of final transcripts
const PACE_MIN_SPEECH_MS = 2_000; // below this much speech in the window, report 0 (no reading yet)
const OVERLAP_WINDOW_MS = 1_500;  // look-back window for overlap
const OVERLAP_MIN_VOICED_MS = 300; // >= 300 ms of *simultaneous* voice (two phones in the same 100 ms slots), so a quick turn change doesn't count
const OVERLAP_SLOT_MS = 100;
const PACE_SPAN_PAD_MS = 350;     // Deepgram word spans skip each turn's onset/offset: measured 240 wpm for 204 wpm TTS without it
const PACE_BRIDGE_MS = 1_000;     // gaps shorter than this between one speaker's finals count as speaking time (commas, breaths)
const PACE_EVERY_MS = 2_000;
const HOST_SOURCE = 'host';
interface FinalRec { at: number; words: number; t0: number; t1: number } // t0/t1: absolute ms (stream epoch + Deepgram word times)

// ---- prosody (voice cues for the gate's tone) ----
const PROS_LOUD = 1.35, PROS_QUIET = 0.65;   // final's voiced RMS vs the speaker's own EMA baseline (±35%)
const PROS_EMA = 0.25;                        // per-final EMA weight
const PROS_MIN_FINALS = 2;                    // baseline needs this many finals before loud/quiet is called
// Rate is per line in SYLLABLES/min: words/min per line swung 111-215 for one constant 185 wpm TTS voice (8 of 21 lines
// read 'fast' at the 185 threshold). Syllables: 185 wpm TTS = 218-275 spm, 230 wpm TTS = 300-440 (one 246). ~1.45 syl/word,
// so 290 spm ~ 200 wpm and 190 spm ~ 130 wpm.
const PROS_FAST_SPM = 290, PROS_SLOW_SPM = 190;
const PROS_MIN_SYL = 6;                       // shorter finals: rate unreliable -> 'normal'
const RMS_KEEP_MS = 30_000;

// ---- cross-stream dedupe: every phone (and the listener's own mic) hears its neighbours ----
export const DEDUPE_HOLD_MS = 1_200;     // each final waits this long for a copy from another stream (interims stay live)
const DEDUPE_WINDOW_MS = 2_500;          // copies must lie within ±2.5 s of each other
const DEDUPE_OVERLAP = 0.55;             // shared tokens / tokens of the shorter line
const LEVEL_KEEP_MS = 30_000;            // per-source chunk RMS ring (also each source's own speaking level)
const BLEED_OWN_MAX = 0.35;              // a word heard below this fraction of the stream's own speaking level…
const BLEED_RATIO = 2.5;                 // …while another stream was >= 2.5x more "owned" is the neighbour's (bleed)
const HOST_PHONE_OWNS = 0.5;             // host-mic word: a phone at >= 0.5 of its speaking level owns it…
const HOST_OWN_RATIO = 1.6;              // …unless the host mic was >= 1.6x that (ME talking; phones only hear bleed)
type TranscriptMsg = Extract<AsrMessage, { type: 'transcript' }>;
const dedupeTokens = (t: string) => new Set(t.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').split(/\s+/).filter(Boolean));
/** Share of `a`'s tokens found in `b`. */
function tokenOverlapOf(a: Set<string>, b: Set<string>): number {
  if (!a.size) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / a.size;
}
export function tokenOverlap(a: Set<string>, b: Set<string>): number {
  const [s, l] = a.size <= b.size ? [a, b] : [b, a];
  if (!s.size) return 0;
  let n = 0;
  for (const w of s) if (l.has(w)) n++;
  return n / s.size;
}
type Src = number | 'host';
interface HeldFinal {
  src: Src; text: string; tokens: Set<string>; t0: number; t1: number; timer: NodeJS.Timeout;
  emit: () => void;   // deliver the final (and its side effects: pace, prosody)
  clear: () => void;  // it lost: clear that source's interim on the hosts
}

// ---- Deepgram keyterms ----
export const MAX_KEYTERMS = 20;
const MAX_PUSHED_TERMS = 10;
const cleanTerm = (t: unknown) => (typeof t === 'string' ? t.replace(/[^\p{L}\p{N}' -]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) : '');

export class Room {
  readonly token: string;
  private hosts = new Set<WebSocket>();
  private parts = new Map<WebSocket, PSock>();
  get participantCount(): number { return this.parts.size; }
  private ids = new Map<string, number>(); // lowercased name -> stable id
  /** Date.now() when the (latest) host Deepgram stream opened: host transcript t=0. */
  hostEpoch: number | null = null;
  private lastListJson = '';
  private tick: NodeJS.Timeout | undefined;
  private paceTick: NodeJS.Timeout | undefined;
  /** Host's own name (POST /api/room/me) — phones say "Good pace for <name>". */
  meName = '';
  /** Table language for Deepgram (nova-3 live: en, it, tr verified 2026-09-26). */
  lang: 'en' | 'it' | 'tr' | 'multi' = 'en';
  private finals = new Map<number, FinalRec[]>();          // participant id -> recent finals
  private voiced = new Map<string, { at: number; ms: number }[]>(); // source -> voiced chunks
  private rmsHist = new Map<number, { at: number; rms: number }[]>(); // participant id -> voiced chunk RMS (prosody)
  private rmsBase = new Map<number, { ema: number; n: number }>();  // participant id -> voiced RMS baseline
  private lastWordEnd = 0;                                          // absolute ms: last word of any participant final
  private levels = new Map<string, { at: number; rms: number; voiced: boolean }[]>(); // source -> every chunk's RMS (dedupe loudness)
  private held: HeldFinal[] = [];
  private recentEmitted: { src: Src; tokens: Set<string>; t0: number; t1: number; at: number }[] = [];
  /** Debug counters: finals dropped as another stream's copy. */
  dedupe = { dropped: 0, keptLater: 0, lateDropped: 0, bleedWords: 0, bleedFinals: 0 };
  /** Host's aliases (POST /api/room/me) and proper nouns pushed by the host client (POST /api/room/terms). */
  meAliases: string[] = [];
  private pushedTerms: string[] = [];
  private termSubs = new Set<() => void>();

  constructor(token: string) { this.token = token; }

  idFor(name: string): number {
    const k = name.trim().toLowerCase();
    let id = this.ids.get(k);
    if (id == null) { id = PARTICIPANT_ID_BASE + this.ids.size; this.ids.set(k, id); }
    return id;
  }

  get hostCount(): number { return this.hosts.size; }
  private noHostTimer: NodeJS.Timeout | undefined;
  /** Run fn once no host has been connected for VOICEID_CLEAR_GRACE_MS (cancelled when a host joins). */
  whenNoHosts(fn: () => void): void {
    if (this.hosts.size) return;
    if (this.noHostTimer) clearTimeout(this.noHostTimer);
    const run = () => { this.noHostTimer = undefined; if (!this.hosts.size) fn(); };
    if (VOICEID_CLEAR_GRACE_MS <= 0) { run(); return; }
    this.noHostTimer = setTimeout(run, VOICEID_CLEAR_GRACE_MS);
    this.noHostTimer.unref?.();
  }
  /** Voice id counters: phone finals identified / re-named; host finals checked / identified / named from the remembered mapping. */
  voiceStats = { phoneIded: 0, phoneRenamed: 0, phoneDupDropped: 0, hostFinals: 0, hostIded: 0, hostRemembered: 0, maxMs: 0, windows: 0, windowMs: 0, changes: 0, splits: 0 };

  addHost(ws: WebSocket): void {
    if (this.noHostTimer) { clearTimeout(this.noHostTimer); this.noHostTimer = undefined; }
    this.hosts.add(ws);
    this.sendTo(ws, { type: 'participants', list: this.list() });
  }
  removeHost(ws: WebSocket): void { this.hosts.delete(ws); }

  addParticipant(ws: WebSocket, name: string): PSock {
    const p: PSock = { name, id: this.idFor(name), speakingUntil: 0 };
    // A phone that reconnects (flaky Wi-Fi, iOS backgrounding) often leaves its old socket half-open: the server never
    // sees a close, so `say` and pace would keep going to a dead socket. Same name => same person => supersede it.
    for (const [old, q] of this.parts) {
      if (q.id === p.id && old !== ws) { this.parts.delete(old); try { old.terminate(); } catch { /* ignore */ } }
    }
    this.parts.set(ws, p);
    this.ensureTick();
    this.ensurePaceTick();
    this.pushList(true);
    this.termsChanged();
    return p;
  }
  removeParticipant(ws: WebSocket): void {
    if (this.parts.delete(ws)) { this.pushList(true); this.termsChanged(); }
  }

  /**
   * Deepgram keyterm list (<= 20): the listener's name + aliases, every joined participant, then up to 10 proper nouns
   * the host client pushed from its ledger/thread labels. Nova-3 keyterm prompting is per connection.
   */
  keyterms(): string[] {
    const out: string[] = []; const seen = new Set<string>();
    const add = (t: string) => { const c = cleanTerm(t); const k = c.toLowerCase(); if (c.length >= 2 && !seen.has(k) && out.length < MAX_KEYTERMS) { seen.add(k); out.push(c); } };
    add(this.meName); this.meAliases.forEach(add);
    for (const p of this.parts.values()) add(p.name);
    this.pushedTerms.forEach(add);
    return out;
  }
  setMe(name: string, aliases: string[] = this.meAliases): void {
    const before = this.keyterms().join('|');
    this.meName = name;
    this.meAliases = aliases.map(cleanTerm).filter(Boolean).slice(0, 5);
    if (this.keyterms().join('|') !== before) this.termsChanged();
  }
  setTerms(terms: unknown[]): string[] {
    const before = this.keyterms().join('|');
    const seen = new Set<string>();
    this.pushedTerms = terms.map(cleanTerm).filter((t) => t.length >= 2 && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, MAX_PUSHED_TERMS);
    if (this.keyterms().join('|') !== before) this.termsChanged();
    return this.keyterms();
  }
  /** Audio sockets subscribe so they can re-open Deepgram with the new keyterms (see asr.ts). Returns unsubscribe. */
  onTerms(fn: () => void): () => void { this.termSubs.add(fn); return () => { this.termSubs.delete(fn); }; }
  private termsChanged(): void { for (const fn of this.termSubs) { try { fn(); } catch { /* ignore */ } } }

  /** Mark a participant as speaking (from audio level or transcript activity). */
  touch(p: PSock): void {
    const was = p.speakingUntil > Date.now();
    p.speakingUntil = Date.now() + SPEAKING_HOLD_MS;
    if (!was) this.pushList();
  }

  /** Participant transcript -> every host, rebased onto the host stream clock and tagged. */
  fromParticipant(p: PSock, m: AsrMessage, participantEpoch: number, voiceOf?: VoiceLookup): void {
    if (m.type !== 'transcript') return;
    if (m.text.trim()) this.touch(p);
    const shift = participantEpoch - (this.hostEpoch ?? participantEpoch);
    const rebase = (x: TranscriptMsg): TranscriptMsg => ({
      ...x, speaker: p.id, name: p.name, tStart: Math.max(0, x.tStart + shift), tEnd: Math.max(0, x.tEnd + shift),
      ...(x.words ? { words: x.words.map((w) => ({ ...w, t0: Math.max(0, w.t0 + shift), t1: Math.max(0, w.t1 + shift) })) } : {}),
    });
    const clear = () => { for (const h of this.hosts) this.sendTo(h, { type: 'transcript', speaker: p.id, name: p.name, text: '', tStart: Math.max(0, m.tStart + shift), tEnd: Math.max(0, m.tEnd + shift), final: false }); };
    if (!m.final || !m.text.trim()) { for (const h of this.hosts) this.sendTo(h, rebase(m)); return; }
    const own = this.stripBleed(p.id, m, participantEpoch);
    if (!own) { clear(); return; }
    const t0 = participantEpoch + own.tStart, t1 = participantEpoch + own.tEnd;
    // Phones + enrolled voices: a phone that picked up its neighbour (bleed the level filter kept) gets the line re-named
    // to the voice that actually spoke, when the fingerprint is confident.
    const hit = voiceOf && roster(this.token).length ? voiceOf(own.tStart, own.tEnd) : null;
    if (hit) this.voiceStats.phoneIded++;
    const minScore = hit?.widened ? Math.max(VOICE_OVERRIDE, 0.7) : VOICE_OVERRIDE; // short line read from a wider window: stricter
    const renamed = hit && hit.score >= minScore && hit.name.trim().toLowerCase() !== p.name.trim().toLowerCase() ? hit.name : null;
    if (renamed) {
      this.voiceStats.phoneRenamed++;
      if (process.env.DEDUPE_LOG !== '0') console.log(`[voiceid] ${p.name}'s phone -> ${renamed} (${hit!.score}): ${own.text.slice(0, 60)}`);
    }
    this.holdFinal(p.id, own.text, t0, t1, () => {
      // Re-named to someone whose own phone already has this line: it's leftover bleed, not a new line. Drop it.
      if (renamed && this.ownPhoneHas(this.idFor(renamed), own.text, t0, t1)) { this.voiceStats.phoneDupDropped++; clear(); return; }
      const out = rebase(own);
      if (hit && (!hit.widened || renamed)) { out.voiceName = hit.name; out.voiceScore = hit.score; }
      if (renamed) { out.name = renamed; out.speaker = this.idFor(renamed); }
      out.prosody = this.prosodyFor(p.id, own.text, t0, t1);
      this.recordFinal(p.id, own.text, t0, t1);
      for (const h of this.hosts) this.sendTo(h, out);
    }, clear);
  }

  /** Did participant `id`'s phone emit (or is it holding) a final within the dedupe window that contains most of `text`? */
  private ownPhoneHas(id: number, text: string, t0: number, t1: number): boolean {
    const mine = dedupeTokens(text);
    if (!mine.size) return false;
    const need = mine.size <= 2 ? 1 : DEDUPE_OVERLAP;
    const near = (a: { t0: number; t1: number }) => a.t0 <= t1 + DEDUPE_WINDOW_MS && t0 <= a.t1 + DEDUPE_WINDOW_MS;
    return [...this.held, ...this.recentEmitted].some((h) => h.src === id && near(h) && tokenOverlapOf(mine, h.tokens) >= need);
  }

  /**
   * Host-mic final (the listener's own device, already attributed/labelled by asr.ts). hostEpoch = when that host's
   * Deepgram stream started. Goes through the same cross-stream dedupe as the phones.
   */
  fromHost(m: AsrMessage, hostEpoch: number, deliver: (m: AsrMessage) => void): void {
    if (m.type !== 'transcript' || !m.final || !m.text.trim() || this.parts.size === 0) { deliver(m); return; }
    const clear = () => deliver({ type: 'transcript', speaker: m.speaker, text: '', tStart: m.tStart, tEnd: m.tEnd, final: false });
    const own = this.stripBleed('host', m, hostEpoch);
    if (!own) { clear(); return; }
    this.holdFinal('host', own.text, hostEpoch + own.tStart, hostEpoch + own.tEnd, () => deliver(own), clear);
  }

  /** Every audio chunk's RMS per source (voiced or not): the loudness judge for cross-stream copies. */
  level(source: Src, rms: number, voiced: boolean): void {
    const k = String(source), now = Date.now();
    const arr = this.levels.get(k) ?? [];
    arr.push({ at: now, rms, voiced });
    while (arr.length && now - arr[0].at > LEVEL_KEEP_MS) arr.shift();
    this.levels.set(k, arr);
  }
  /** A source's own speaking level: 80th percentile of its voiced chunk RMS over the last 30 s (null = too little). */
  private levelBase(k: string, floor = true): number | null {
    const v = (this.levels.get(k) ?? []).filter((x) => x.voiced).map((x) => x.rms).sort((a, b) => a - b);
    const own = v.length >= 10 ? v[Math.floor(v.length * 0.8)] : null;
    if (!floor) return own;
    // Floor at 0.8x the other phones' median level: a phone whose owner hasn't spoken yet has only heard its neighbour,
    // and must not take that bleed as its owner's normal level (measured: Dad's phone kept Mom's first line).
    const others = [...this.levels.keys()].filter((o) => o !== k && o !== 'host').map((o) => this.levelBase(o, false)).filter((x): x is number => x != null).sort((a, b) => a - b);
    const med = others.length ? others[Math.floor(others.length / 2)] * 0.8 : null;
    return own != null && med != null ? Math.max(own, med) : own ?? med;
  }
  /**
   * How loud a source was over [t0, t1] (absolute ms) RELATIVE to its own speaking level: ~1 when its owner talks,
   * ~0.25 when it only hears a neighbour 12 dB down. Raw RMS isn't comparable across phones (mic gain, distance).
   */
  score(source: Src | string, t0: number, t1: number, peak = false): number {
    const k = String(source);
    const arr = (this.levels.get(k) ?? []).filter((x) => x.at >= t0 && x.at <= t1 + 100);
    if (!arr.length) return 0;
    const base = this.levelBase(k);
    const v = peak ? Math.max(...arr.map((x) => x.rms)) : arr.reduce((a, x) => a + x.rms, 0) / arr.length;
    return base ? v / base : 1;
  }

  /**
   * Word-level bleed removal (per-word PEAK chunk level: Deepgram stretches words into the silence around them, so a
   * mean read "Bera," / "time." as quiet): a word this stream heard while it was quiet for its owner (< 0.35 of its speaking level)
   * and another stream was >= 2.5x more "owned" at that moment belongs to the neighbour. Deepgram happily merges the
   * owner's line and the neighbour's bleed into one final ("Fine by me. Less cooking for Everyone brings a side…"),
   * so a sentence-level dedupe alone can't separate them. Returns null when nothing of the owner's is left.
   */
  stripBleed(src: Src, m: TranscriptMsg, epoch: number): TranscriptMsg | null {
    if (!m.words?.length || this.levels.size < 2) return m;
    const others = [...this.levels.keys()].filter((k) => k !== String(src));
    const keep = m.words.filter((w) => {
      const a = epoch + w.t0, b = epoch + w.t1;
      const mine = this.score(src, a, b, true);
      if (src === 'host') {
        // The listener's mic hears everyone at about its normal level; a word is ME's only if no phone owned it.
        const phone = Math.max(0, ...others.filter((k) => k !== 'host').map((k) => this.score(k, a, b, true)));
        return !(phone >= HOST_PHONE_OWNS && mine < HOST_OWN_RATIO * phone);
      }
      if (mine >= BLEED_OWN_MAX) return true;
      // The host mic scores ~0.8 for anyone's voice: it only takes a phone's word when clearly louder (ME talking).
      const best = Math.max(0, ...others.map((k) => this.score(k, a, b, true) / (k === 'host' ? HOST_OWN_RATIO * 2 : 1)));
      return best < BLEED_RATIO * Math.max(mine, 0.02);
    });
    if (keep.length === m.words.length) return m;
    this.dedupe.bleedWords += m.words.length - keep.length;
    // Nothing left, or a 1-2 word crumb of a line that was mostly someone else's ("So", "the at"): drop it all.
    const content = keep.filter((w) => /[\p{L}\p{N}]/u.test(w.w)).length;
    if (!content || (content <= 2 && keep.length < 0.4 * m.words.length)) { this.dedupe.bleedFinals++; this.logDedupe(src, 'bleed', m.text, 'all words bleed'); return null; }
    const text = keep.map((w) => w.w).join(' ');
    if (process.env.DEDUPE_LOG !== '0') console.log(`[dedupe] ${this.srcName(src)} bleed words removed: "${m.text}" -> "${text}"`);
    return { ...m, text, words: keep, tStart: keep[0].t0, tEnd: keep[keep.length - 1].t1 };
  }

  /**
   * Hold a final DEDUPE_HOLD_MS; if another source produced the same sentence (token overlap >= 0.55 of the shorter line,
   * within ±2.5 s), keep the one whose stream "owned" it (higher score = louder vs its own speaking level) and drop the
   * other (its interim is cleared). Near-ties (< 1.3x) go to a phone over the host mic: the host hears everyone about
   * equally, the phone is on its owner. A copy arriving after its twin was emitted is dropped unless it clearly owns it.
   */
  holdFinal(src: Src, text: string, t0: number, t1: number, emit: () => void, clear: () => void): void {
    const tokens = dedupeTokens(text);
    const near = (a: { t0: number; t1: number }) => a.t0 <= t1 + DEDUPE_WINDOW_MS && t0 <= a.t1 + DEDUPE_WINDOW_MS;
    /** Share of `loser`'s tokens found in `winner`: only a line that is MOSTLY the other's copy gets dropped
     *  ("Good luck with that. We're never on time. Are you coming" is not a copy of "Are you coming Sunday?"). */
    const covered = (loser: Set<string>, winner: Set<string>) => {
      if (loser.size < 2 || winner.size < 2) return [...loser].join(' ') === [...winner].join(' ');
      let n = 0; for (const w of loser) if (winner.has(w)) n++;
      return n / loser.size >= DEDUPE_OVERLAP;
    };
    const same = (b: Set<string>) => covered(tokens, b) || covered(b, tokens);
    const now = Date.now();
    this.recentEmitted = this.recentEmitted.filter((r) => now - r.at <= 10_000);
    const mine = this.score(src, t0, t1);
    // Two people can both say "sounds good": for short lines only a clearly weaker stream (< 1/2) is a copy.
    const copy = (b: Set<string>, theirs: number) => same(b) && (Math.min(tokens.size, b.size) >= 4 || Math.max(mine, theirs) >= 2 * Math.min(mine, theirs));
    /** true when `a` (score sa, source srcA) should win over `b`. */
    const wins = (sa: number, srcA: Src, sb: number, srcB: Src) =>
      srcA === 'host' ? sa >= 1.3 * sb : srcB === 'host' ? sa * 1.3 > sb : sa > sb;
    const late = this.recentEmitted.find((r) => r.src !== src && near(r) && covered(tokens, r.tokens) && copy(r.tokens, this.score(r.src, r.t0, r.t1)));
    if (late) {
      const theirs = this.score(late.src, late.t0, late.t1);
      if (!(wins(mine, src, theirs, late.src) && mine >= 1.5 * theirs)) { this.dedupe.lateDropped++; this.logDedupe(src, late.src, text, `late ${mine.toFixed(2)}/${theirs.toFixed(2)}`); clear(); return; }
    }
    for (const h of [...this.held]) {
      if (h.src === src || !near(h)) continue;
      const theirs = this.score(h.src, h.t0, h.t1);
      if (!copy(h.tokens, theirs)) continue;
      const iWin = wins(mine, src, theirs, h.src);
      if (!(iWin ? covered(h.tokens, tokens) : covered(tokens, h.tokens))) continue; // the loser must be mostly a copy
      if (!iWin) { this.dedupe.dropped++; this.logDedupe(src, h.src, text, `${mine.toFixed(2)}<${theirs.toFixed(2)}`); clear(); return; }
      clearTimeout(h.timer);
      this.held = this.held.filter((x) => x !== h);
      this.dedupe.dropped++; this.dedupe.keptLater++;
      this.logDedupe(h.src, src, h.text, `${theirs.toFixed(2)}<${mine.toFixed(2)}`);
      h.clear();
    }
    const item: HeldFinal = { src, text, tokens, t0, t1, emit, clear, timer: setTimeout(() => {
      this.held = this.held.filter((x) => x !== item);
      this.recentEmitted.push({ src, tokens, t0, t1, at: Date.now() });
      emit();
    }, DEDUPE_HOLD_MS) };
    item.timer.unref?.();
    this.held.push(item);
  }
  private logDedupe(dropped: Src, kept: Src | 'bleed', text: string, why: string): void {
    if (process.env.DEDUPE_LOG !== '0') console.log(`[dedupe] drop ${this.srcName(dropped)} keep ${this.srcName(kept)} (${why}): ${text.slice(0, 60)}`);
  }
  private srcName(s: Src | 'bleed'): string {
    if (s === 'host' || s === 'bleed') return s;
    for (const p of this.parts.values()) if (p.id === s) return p.name;
    return String(s);
  }

  /**
   * Voice cues for one participant final (absolute ms t0..t1): loudness = mean voiced RMS over the line vs that speaker's
   * EMA baseline (updated after), rate = this line's wpm (same span rules as wpmOf), pause = silence since the last
   * word of any participant final. TTS (constant level/rate) should come out normal/normal.
   */
  prosodyFor(id: number, text: string, t0: number, t1: number): Prosody {
    const words = text.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    const hist = this.rmsHist.get(id) ?? [];
    const inLine = hist.filter((h) => h.at >= t0 && h.at <= t1 + 150);
    let loud: Prosody['loud'] = 'normal';
    if (inLine.length) {
      const rms = inLine.reduce((a, h) => a + h.rms, 0) / inLine.length;
      const b = this.rmsBase.get(id);
      if (b && b.n >= PROS_MIN_FINALS) loud = rms > b.ema * PROS_LOUD ? 'loud' : rms < b.ema * PROS_QUIET ? 'quiet' : 'normal';
      // Only 'normal' lines move the baseline fast; a shouted line nudges it less, so one outburst doesn't become "normal".
      const w = loud === 'normal' ? PROS_EMA : PROS_EMA / 3;
      this.rmsBase.set(id, b ? { ema: b.ema * (1 - w) + rms * w, n: b.n + 1 } : { ema: rms, n: 1 });
    }
    let rate: Prosody['rate'] = 'normal';
    const syl = syllables(text);
    // Same span rules as wpmOf: pad the onset/offset Deepgram skips, floor 0.15 s per syllable against mistimed words.
    const spm = syl / ((Math.max(t1, t0 + syl * 150) - t0 + PACE_SPAN_PAD_MS) / 60_000);
    if (syl >= PROS_MIN_SYL) rate = spm > PROS_FAST_SPM ? 'fast' : spm < PROS_SLOW_SPM ? 'slow' : 'normal';
    const pauseBeforeMs = this.lastWordEnd ? Math.min(10_000, Math.max(0, Math.round(t0 - this.lastWordEnd))) : 0;
    if (process.env.PROS_LOG) console.log(`[prosody] ${id} words=${words} syl=${syl} spm=${Math.round(spm)} rms=${inLine.length ? (inLine.reduce((a, h) => a + h.rms, 0) / inLine.length).toFixed(3) : '-'} base=${this.rmsBase.get(id)?.ema.toFixed(3)} -> ${loud}/${rate}/+${pauseBeforeMs}`);
    this.lastWordEnd = Math.max(this.lastWordEnd, t1);
    return { loud, rate, pauseBeforeMs };
  }

  /** A voiced PCM chunk from a source (participant id or the host mic); feeds overlap detection (+ prosody when rms is given). */
  voice(source: number | typeof HOST_SOURCE, ms: number, rms?: number): void {
    const k = String(source);
    const now = Date.now();
    if (typeof source === 'number' && typeof rms === 'number') {
      const h = (this.rmsHist.get(source) ?? []).filter((x) => now - x.at <= RMS_KEEP_MS);
      h.push({ at: now, rms });
      this.rmsHist.set(source, h);
    }
    const arr = (this.voiced.get(k) ?? []).filter((v) => now - v.at <= OVERLAP_WINDOW_MS);
    arr.push({ at: now, ms });
    this.voiced.set(k, arr);
    this.maybeLaugh(now);
  }
  hostVoice(ms: number): void { this.voice(HOST_SOURCE, ms); }

  private lastLaughAt = 0;
  /** Laughter proxy: ≥2 phones voiced ≥900 ms within the last 2 s and none of them produced words in the last 3 s. */
  private maybeLaugh(now: number): void {
    if (now - this.lastLaughAt < 8000) return;
    let loud = 0;
    for (const [k, arr] of this.voiced) {
      if (k === String(HOST_SOURCE)) continue;
      const ms = arr.filter((v) => now - v.at <= 2000).reduce((a, v) => a + v.ms, 0);
      if (ms < 900) continue;
      const id = Number(k);
      const spoke = (this.finals.get(id) ?? []).some((f) => now - f.at <= 3000);
      if (!spoke) loud++;
    }
    if (loud < 2) return;
    this.lastLaughAt = now;
    for (const h of this.hosts) this.sendTo(h, { type: 'laugh', t: now, sources: loud });
  }

  /** t0/t1 = absolute start/end of the final's words (ms). */
  recordFinal(id: number, text: string, t0: number, t1: number): void {
    const words = text.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    if (!words) return;
    const now = Date.now();
    const arr = (this.finals.get(id) ?? []).filter((f) => now - f.at <= PACE_WINDOW_MS);
    arr.push({ at: now, words, t0, t1: Math.max(t1, t0) });
    this.finals.set(id, arr);
  }

  /**
   * Speaking rate over the rolling window: words / minutes of speaking time, 0 if too little speech.
   * Speaking time = union of the finals' word spans with gaps < 1 s bridged. Summing each final's own span (the old
   * way) dropped the pauses between Deepgram's fragments and read ~30% fast: TTS measured at 204 wpm read as 260.
   * Each span is floored at 0.25 s/word so a mistimed one-word final can't read as 600 wpm.
   */
  wpmOf(id: number, now = Date.now()): number {
    const arr = (this.finals.get(id) ?? []).filter((f) => now - f.at <= PACE_WINDOW_MS)
      .map((f) => ({ ...f, t1: Math.max(f.t1, f.t0 + f.words * 250) })).sort((a, b) => a.t0 - b.t0);
    let words = 0, ms = 0, s0 = -1, s1 = -1;
    for (const f of arr) {
      words += f.words;
      if (s0 < 0) { s0 = f.t0; s1 = f.t1; continue; }
      if (f.t0 - s1 < PACE_BRIDGE_MS) s1 = Math.max(s1, f.t1);
      else { ms += s1 - s0 + PACE_SPAN_PAD_MS; s0 = f.t0; s1 = f.t1; }
    }
    if (s0 >= 0) ms += s1 - s0 + PACE_SPAN_PAD_MS;
    if (ms < PACE_MIN_SPEECH_MS) return 0;
    return Math.round(words / (ms / 60_000));
  }

  /**
   * >= 300 ms in the last 1.5 s where two or more PHONES were voiced in the same 100 ms slots. The old rule (each source
   * voiced >= 300 ms anywhere in the window) fired on every quick turn change: 24 false overlap flags in a clean
   * sequential run. The host mic is excluded: it hears everyone, so host + the talking phone is not crosstalk.
   */
  overlap(now = Date.now()): boolean { return this.overlappingIds(now).size > 0; }

  /** The participant ids that were voiced in the same 100 ms slots as someone else for >= OVERLAP_MIN_VOICED_MS. */
  overlappingIds(now = Date.now()): Set<number> {
    const slots = new Map<number, Set<string>>();
    const perSource = new Map<string, Set<number>>();
    for (const [k, arr] of this.voiced) {
      if (k === HOST_SOURCE) continue;
      const mine = new Set<number>();
      for (const v of arr) {
        if (now - v.at > OVERLAP_WINDOW_MS) continue;
        for (let t = v.at - v.ms; t < v.at; t += OVERLAP_SLOT_MS) mine.add(Math.floor(t / OVERLAP_SLOT_MS));
      }
      perSource.set(k, mine);
      for (const sl of mine) { if (!slots.has(sl)) slots.set(sl, new Set()); slots.get(sl)!.add(k); }
    }
    const out = new Set<number>();
    for (const [k, mine] of perSource) {
      let shared = 0;
      for (const sl of mine) if ((slots.get(sl)?.size ?? 0) >= 2) shared++;
      if (shared * OVERLAP_SLOT_MS >= OVERLAP_MIN_VOICED_MS) out.add(Number(k));
    }
    return out;
  }

  /** Host-computed mood → every phone (each gets its owner's own tone, positive ones only). */
  setMood(table: 'warm'|'tense'|'light'|'quiet', byName: Record<string, string>): void {
    for (const [ws, p] of this.parts) {
      const mine = byName[p.name] ?? byName[p.name.toLowerCase()];
      const ok = mine === 'warm' || mine === 'light' || mine === 'excited' || mine === 'teasing';
      this.sendTo(ws, { type: 'mood', table, ...(ok ? { mine: mine as never } : {}) });
    }
  }

  /** Show the host user's words on every participant phone (text-first Speak for me). */
  say(text: string, audio?: string, voice = false): number {
    const name = this.meName.trim() || 'They';
    const m = { type: 'say' as const, name, text, t: Date.now(), voice, ...(audio ? { audio } : {}) };
    // Count phones (people) that actually got it: open sockets only, one per participant id.
    const got = new Set<number>();
    for (const [ws, p] of this.parts) if (this.sendTo(ws, m)) got.add(p.id);
    return got.size;
  }

  private pushPace(): void {
    const now = Date.now();
    const overlapping = this.overlappingIds(now);
    const overlap = overlapping.size > 0;
    const listenerName = this.meName.trim() || 'the table';
    const active: number[] = [];
    const seen = new Set<number>();
    for (const [ws, p] of this.parts) {
      const wpm = this.wpmOf(p.id, now);
      if (!seen.has(p.id)) { seen.add(p.id); if (wpm > 0) active.push(wpm); }
      // Only the phones that were actually talking over someone get the "one at a time" state.
      this.sendTo(ws, { type: 'pace', wpm, level: paceLevel(wpm), overlap: overlapping.has(p.id), listenerName });
    }
    const avgWpm = active.length ? Math.round(active.reduce((a, b) => a + b, 0) / active.length) : 0;
    for (const h of this.hosts) this.sendTo(h, { type: 'table', overlap, avgWpm });
    // drop stale sources
    for (const [k, arr] of this.voiced) if (!arr.some((v) => now - v.at <= OVERLAP_WINDOW_MS)) this.voiced.delete(k);
  }

  private ensurePaceTick(): void {
    if (this.paceTick) return;
    this.paceTick = setInterval(() => {
      if (!this.parts.size) {
        clearInterval(this.paceTick); this.paceTick = undefined;
        for (const h of this.hosts) this.sendTo(h, { type: 'table', overlap: false, avgWpm: 0 });
        return;
      }
      this.pushPace();
    }, PACE_EVERY_MS);
    this.paceTick.unref();
  }

  list(): Participant[] {
    const now = Date.now();
    const byId = new Map<number, Participant>();
    for (const p of this.parts.values()) {
      const cur = byId.get(p.id);
      const speaking = p.speakingUntil > now;
      if (cur) cur.speaking ||= speaking;
      else byId.set(p.id, { id: p.id, name: p.name, speaking });
    }
    return [...byId.values()].sort((a, b) => a.id - b.id);
  }

  private pushList(force = false): void {
    const list = this.list();
    const json = JSON.stringify(list);
    if (!force && json === this.lastListJson) return;
    this.lastListJson = json;
    for (const h of this.hosts) this.sendTo(h, { type: 'participants', list });
  }

  /** Speaking dots decay on their own; poll only while participants exist. */
  private ensureTick(): void {
    if (this.tick) return;
    this.tick = setInterval(() => {
      if (!this.parts.size) { clearInterval(this.tick); this.tick = undefined; return; }
      this.pushList();
    }, 400);
    this.tick.unref();
  }

  private sendTo(ws: WebSocket, m: AsrMessage): boolean {
    if (ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(m));
    return true;
  }

  /** Debug/leak check: live sockets and per-id state sizes. */
  stats() { return { dedupe: this.dedupe, held: this.held.length, hosts: this.hosts.size, parts: this.parts.size, ids: this.ids.size, finals: this.finals.size, voiced: this.voiced.size, rms: this.rmsHist.size, termSubs: this.termSubs.size, voice: this.voiceStats }; }
}

/** Rough English syllable count (vowel groups, silent final e, digits as ~1.5): speech rate in syllables is far less
 *  noisy per line than words/min, which swings with word length ("Thanksgiving" vs "at"). */
export function syllables(text: string): number {
  let n = 0;
  for (const raw of text.toLowerCase().split(/\s+/)) {
    const w = raw.replace(/[^a-z0-9']/g, '');
    if (!w) continue;
    if (/^\d{1,2}:\d\d/.test(raw)) { n += 3; continue; }              // "1:00" = "one o'clock"
    if (/^\d/.test(w)) { n += Math.min(6, Math.max(1, Math.round(w.replace(/\D/g, '').length * 1.5))); continue; }
    const groups = w.replace(/'/g, '').replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').match(/[aeiouy]+/g);
    n += Math.max(1, groups?.length ?? 0);
  }
  return n;
}

/** RMS of a PCM16 LE buffer, 0..1. */
export function pcmRms(buf: Buffer): number {
  const n = Math.floor(buf.length / 2);
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) { const v = buf.readInt16LE(i * 2) / 32768; sum += v * v; }
  return Math.sqrt(sum / n);
}
export const isVoice = (buf: Buffer) => pcmRms(buf) > SPEAKING_RMS;

/**
 * Per-socket voice detector with an adaptive noise floor: voiced = RMS above max(0.02, 3 x floor), floor = 10th
 * percentile of the last ~64 chunks. A fixed 0.02 gate called a phone in a noisy room "speaking" all the time,
 * which lit its dot and made every other speaker read as overlap.
 */
export class Vad {
  private hist: number[] = [];
  /** RMS of the last chunk passed to isVoice (prosody loudness). */
  lastRms = 0;
  isVoice(buf: Buffer): boolean {
    const rms = pcmRms(buf);
    this.lastRms = rms;
    this.hist.push(rms);
    if (this.hist.length > 64) this.hist.shift();
    const floor = this.hist.length >= 10 ? [...this.hist].sort((a, b) => a - b)[Math.floor(this.hist.length * 0.1)] : 0;
    return rms > Math.max(SPEAKING_RMS, floor * 3);
  }
}

// ---- the (single) room ----
/** ROOM_TOKEN env, else a random token persisted in the OS temp dir so `tsx watch` restarts don't break joined phones. */
function bootToken(): string {
  const env = process.env.ROOM_TOKEN?.trim();
  if (env) return env;
  const file = join(tmpdir(), 'imt-room-token');
  try { const t = readFileSync(file, 'utf8').trim(); if (/^[a-f0-9]{8}$/.test(t)) return t; } catch { /* first boot */ }
  const t = randomBytes(4).toString('hex');
  try { writeFileSync(file, t); } catch { /* read-only tmp: token just won't survive restarts */ }
  return t;
}
export const room = new Room(bootToken());
const rooms = new Map<string, Room>([[room.token, room]]);

/** Table codes: 4 characters people can read out across a table (no 0/O, 1/I/L). Lookup is case-insensitive. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function createRoom(): Room {
  let code = '';
  do { code = Array.from(randomBytes(4), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(''); } while (rooms.has(code));
  const r = new Room(code);
  r.lang = room.lang;
  rooms.set(code, r);
  return r;
}
export function findRoom(token: string | undefined | null): Room | undefined {
  if (!token) return undefined;
  const t = token.trim();
  const hit = rooms.get(t) ?? rooms.get(t.toUpperCase());
  if (hit) return hit;
  // Tables live in memory: after a server restart a phone still holds its code. Re-open a well-formed code instead of
  // refusing it, so the listener never sits on "offline" and speakers typing the same code land on the same table.
  const u = t.toUpperCase();
  if (/^[A-Z0-9]{4}$/.test(u)) { const r = new Room(u); r.lang = room.lang; rooms.set(u, r); return r; }
  return undefined;
}
/** The room an HTTP call means: its ?token= (or body.token), else the default room (replay / legacy links). */
export function pickRoom(token: string | undefined | null): Room { return findRoom(token) ?? room; }

export interface JoinParams { role: Role; name: string; room: Room }

/**
 * Parse ?role=&name=&token= from a WS upgrade URL. Returns null when the token is wrong.
 * Host with no token = legacy behaviour (joins the default room); participant must present it.
 */
export function parseJoin(url: string | undefined): JoinParams | null {
  const q = new URL(url ?? '/', 'http://x').searchParams;
  const role: Role = q.get('role') === 'participant' ? 'participant' : 'host';
  const token = q.get('token');
  const name = (q.get('name') ?? '').trim().slice(0, 40);
  if (role === 'participant') {
    const r = findRoom(token);
    if (!r || !name) return null;
    return { role, name, room: r };
  }
  if (token == null || token === '') return { role, name, room };
  const r = findRoom(token);
  return r ? { role, name, room: r } : null;
}

function lanIp(): string {
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) return a.address;
  }
  return 'localhost';
}

/** PUBLIC_URL (e.g. a cloudflared tunnel) wins; otherwise guess LAN IP + the Vite dev port. */
export function roomInfo(r: Room = room): RoomInfo {
  const base = (process.env.PUBLIC_URL?.trim() || `http://${lanIp()}:${process.env.CLIENT_PORT || 5174}`).replace(/\/$/, '');
  return { token: r.token, joinUrl: `${base}/join.html?token=${r.token}` };
}

export function registerRooms(app: FastifyInstance): void {
  app.get<{ Querystring: { token?: string } }>('/api/room', async (req): Promise<RoomInfo> => roomInfo(pickRoom(req.query.token)));
  // A new table with its own code. The listener's phone calls this once; everyone else types the code.
  app.post('/api/rooms', async () => roomInfo(createRoom()));
  // Lets the join page tell "wrong/stale link" apart from a network drop (WS upgrade 401s are opaque in browsers).
  app.get<{ Querystring: { token?: string } }>('/api/room/verify', async (req, reply) => {
    const ok = !!findRoom(req.query.token);
    return reply.code(ok ? 200 : 401).send({ ok });
  });
  // Host tells the room its user's name so phones can say "Good pace for Bera".
  // Host user's line → text on every phone. Body: {text}. Returns how many phones got it.
  app.post<{ Querystring: { token?: string }; Body: { text?: unknown; voice?: unknown } }>('/api/room/say', async (req, reply) => {
    const room = pickRoom(req.query.token);
    const t = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 240) : '';
    if (!t) return reply.code(400).send({ ok: false });
    const voice = req.body?.voice === true;
    const audio = voice ? await elevenLabsMp3(t, room.lang) : undefined;
    return { ok: true, delivered: room.say(t, audio, voice), spoken: !!audio };
  });
  // Table language: applies to every NEW audio socket (host + phones). Client reconnects after changing it.
  app.post<{ Querystring: { token?: string }; Body: { lang?: unknown } }>('/api/room/lang', async (req, reply) => {
    const room = pickRoom(req.query.token);
    const l = String(req.body?.lang ?? '');
    if (!['en', 'it', 'tr', 'multi'].includes(l)) return reply.code(400).send({ ok: false });
    room.lang = l as Room['lang'];
    return { ok: true, lang: room.lang };
  });
  app.get<{ Querystring: { token?: string } }>('/api/room/lang', async (req) => ({ lang: pickRoom(req.query.token).lang }));
  // Host posts the table mood + per-speaker recent tone (by name); phones get a `mood` message.
  app.post<{ Querystring: { token?: string }; Body: { table?: unknown; speakers?: unknown } }>('/api/room/mood', async (req) => {
    const room = pickRoom(req.query.token);
    const t = String(req.body?.table ?? 'quiet');
    const table = (['warm', 'tense', 'light', 'quiet'] as const).includes(t as never) ? (t as 'warm'|'tense'|'light'|'quiet') : 'quiet';
    const sp = (req.body?.speakers && typeof req.body.speakers === 'object') ? req.body.speakers as Record<string, string> : {};
    room.setMood(table, sp);
    return { ok: true };
  });
  app.post<{ Querystring: { token?: string }; Body: { name?: unknown; aliases?: unknown } }>('/api/room/me', async (req) => {
    const room = pickRoom(req.query.token);
    const n = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 40) : '';
    const aliases = Array.isArray(req.body?.aliases) ? (req.body.aliases as unknown[]).filter((a): a is string => typeof a === 'string') : undefined;
    room.setMe(n, aliases);
    return { ok: true, name: n, keyterms: room.keyterms() };
  });
  // Host client pushes proper nouns from its ledger/thread labels; they become Deepgram keyterms (<= 10 of the 20).
  app.post<{ Querystring: { token?: string }; Body: { terms?: unknown } }>('/api/room/terms', async (req, reply) => {
    const room = pickRoom(req.query.token);
    if (!Array.isArray(req.body?.terms)) return reply.code(400).send({ ok: false });
    return { ok: true, keyterms: room.setTerms(req.body.terms as unknown[]) };
  });
}

/** ElevenLabs TTS → base64 mp3, or undefined when no key / on error (phones fall back to browser speech). */
async function elevenLabsMp3(text: string, lang: string): Promise<string | undefined> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return undefined;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'XB0fDUnXU5powFXDhCwa'; // Charlotte (multilingual)
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.6, similarity_boost: 0.75 }, ...(lang !== 'multi' ? { language_code: lang } : {}) }),
    });
    clearTimeout(to);
    if (!res.ok) { console.warn('[say] elevenlabs', res.status); return undefined; }
    return Buffer.from(await res.arrayBuffer()).toString('base64');
  } catch (e) { console.warn('[say] elevenlabs failed', (e as Error).message); return undefined; }
}
