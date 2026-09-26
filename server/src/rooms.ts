// "Everyone joins" mode: one room per server boot, keyed by a token.
// Host sockets (the deaf user's device) receive their own diarized transcript PLUS every
// participant's transcript, tagged with the participant's name. Participants only send audio.
import { randomBytes } from 'node:crypto';
import { networkInterfaces, tmpdir } from 'node:os';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import type { AsrMessage, Participant, RoomInfo } from '../../shared/types';
import { paceLevel } from '../../shared/types';

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

export class Room {
  readonly token: string;
  private hosts = new Set<WebSocket>();
  private parts = new Map<WebSocket, PSock>();
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

  constructor(token: string) { this.token = token; }

  idFor(name: string): number {
    const k = name.trim().toLowerCase();
    let id = this.ids.get(k);
    if (id == null) { id = PARTICIPANT_ID_BASE + this.ids.size; this.ids.set(k, id); }
    return id;
  }

  addHost(ws: WebSocket): void {
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
    return p;
  }
  removeParticipant(ws: WebSocket): void {
    if (this.parts.delete(ws)) this.pushList(true);
  }

  /** Mark a participant as speaking (from audio level or transcript activity). */
  touch(p: PSock): void {
    const was = p.speakingUntil > Date.now();
    p.speakingUntil = Date.now() + SPEAKING_HOLD_MS;
    if (!was) this.pushList();
  }

  /** Participant transcript -> every host, rebased onto the host stream clock and tagged. */
  fromParticipant(p: PSock, m: AsrMessage, participantEpoch: number): void {
    if (m.type !== 'transcript') return;
    const shift = participantEpoch - (this.hostEpoch ?? participantEpoch);
    const out: AsrMessage = {
      ...m, speaker: p.id, name: p.name, tStart: Math.max(0, m.tStart + shift), tEnd: Math.max(0, m.tEnd + shift),
      ...(m.words ? { words: m.words.map((w) => ({ ...w, t0: Math.max(0, w.t0 + shift), t1: Math.max(0, w.t1 + shift) })) } : {}),
    };
    if (m.text.trim()) this.touch(p);
    if (m.final) this.recordFinal(p.id, m.text, participantEpoch + m.tStart, participantEpoch + m.tEnd);
    for (const h of this.hosts) this.sendTo(h, out);
  }

  /** A voiced PCM chunk from a source (participant id or the host mic); feeds overlap detection. */
  voice(source: number | typeof HOST_SOURCE, ms: number): void {
    const k = String(source);
    const now = Date.now();
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
  overlap(now = Date.now()): boolean {
    const slots = new Map<number, number>();
    for (const [k, arr] of this.voiced) {
      if (k === HOST_SOURCE) continue;
      const mine = new Set<number>();
      for (const v of arr) {
        if (now - v.at > OVERLAP_WINDOW_MS) continue;
        for (let t = v.at - v.ms; t < v.at; t += OVERLAP_SLOT_MS) mine.add(Math.floor(t / OVERLAP_SLOT_MS));
      }
      for (const sl of mine) slots.set(sl, (slots.get(sl) ?? 0) + 1);
    }
    let both = 0;
    for (const n of slots.values()) if (n >= 2) both++;
    return both * OVERLAP_SLOT_MS >= OVERLAP_MIN_VOICED_MS;
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
    const overlap = this.overlap(now);
    const listenerName = this.meName.trim() || 'the table';
    const active: number[] = [];
    const seen = new Set<number>();
    for (const [ws, p] of this.parts) {
      const wpm = this.wpmOf(p.id, now);
      if (!seen.has(p.id)) { seen.add(p.id); if (wpm > 0) active.push(wpm); }
      this.sendTo(ws, { type: 'pace', wpm, level: paceLevel(wpm), overlap, listenerName });
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
  stats() { return { hosts: this.hosts.size, parts: this.parts.size, ids: this.ids.size, finals: this.finals.size, voiced: this.voiced.size }; }
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
  isVoice(buf: Buffer): boolean {
    const rms = pcmRms(buf);
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
    const r = token ? rooms.get(token) : undefined;
    if (!r || !name) return null;
    return { role, name, room: r };
  }
  if (token == null || token === '') return { role, name, room };
  const r = rooms.get(token);
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
  app.get('/api/room', async (): Promise<RoomInfo> => roomInfo());
  // Lets the join page tell "wrong/stale link" apart from a network drop (WS upgrade 401s are opaque in browsers).
  app.get<{ Querystring: { token?: string } }>('/api/room/verify', async (req, reply) => {
    const ok = !!req.query.token && rooms.has(req.query.token);
    return reply.code(ok ? 200 : 401).send({ ok });
  });
  // Host tells the room its user's name so phones can say "Good pace for Bera".
  // Host user's line → text on every phone. Body: {text}. Returns how many phones got it.
  app.post<{ Body: { text?: unknown; voice?: unknown } }>('/api/room/say', async (req, reply) => {
    const t = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 240) : '';
    if (!t) return reply.code(400).send({ ok: false });
    const voice = req.body?.voice === true;
    const audio = voice ? await elevenLabsMp3(t, room.lang) : undefined;
    return { ok: true, delivered: room.say(t, audio, voice), spoken: !!audio };
  });
  // Table language: applies to every NEW audio socket (host + phones). Client reconnects after changing it.
  app.post<{ Body: { lang?: unknown } }>('/api/room/lang', async (req, reply) => {
    const l = String(req.body?.lang ?? '');
    if (!['en', 'it', 'tr', 'multi'].includes(l)) return reply.code(400).send({ ok: false });
    room.lang = l as Room['lang'];
    return { ok: true, lang: room.lang };
  });
  app.get('/api/room/lang', async () => ({ lang: room.lang }));
  app.post<{ Body: { name?: unknown } }>('/api/room/me', async (req) => {
    const n = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 40) : '';
    room.meName = n;
    return { ok: true, name: n };
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
