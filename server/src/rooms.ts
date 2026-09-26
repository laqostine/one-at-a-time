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

/** Participant speaker ids start here so they never collide with Deepgram diarization ids (0..n). */
export const PARTICIPANT_ID_BASE = 100;
const SPEAKING_HOLD_MS = 1200;
const SPEAKING_RMS = 0.02; // PCM16 RMS (0..1) above which we call it voice

export type Role = 'host' | 'participant';

interface PSock { name: string; id: number; speakingUntil: number }

export class Room {
  readonly token: string;
  private hosts = new Set<WebSocket>();
  private parts = new Map<WebSocket, PSock>();
  private ids = new Map<string, number>(); // lowercased name -> stable id
  /** Date.now() when the (latest) host Deepgram stream opened: host transcript t=0. */
  hostEpoch: number | null = null;
  private lastListJson = '';
  private tick: NodeJS.Timeout | undefined;

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
    this.parts.set(ws, p);
    this.ensureTick();
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
    const out: AsrMessage = { ...m, speaker: p.id, name: p.name, tStart: Math.max(0, m.tStart + shift), tEnd: Math.max(0, m.tEnd + shift) };
    if (m.text.trim()) this.touch(p);
    for (const h of this.hosts) this.sendTo(h, out);
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

  private sendTo(ws: WebSocket, m: AsrMessage): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
  }
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
}
