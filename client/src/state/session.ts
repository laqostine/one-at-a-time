// Pure session reducer + selectors. Browser is the source of truth.
import {
  SPEAKER_COLORS,
  type AsrMessage, type AudioEvent, type LedgerItem, type Session, type Speaker,
  type TimelineItem, type Utterance,
} from '../../../shared/types';

export const RING_MS = 15 * 60 * 1000;
export const UNKNOWN_COLOR = '#9CA3AF';

/** Session plus client-only bookkeeping (merged diarization ids). Structurally a Session. */
export interface SessionState extends Session {
  /** diarization id -> canonical id after "same person as…" merges */
  merged: Record<number, number>;
}

export type SessionAction =
  | { type: 'transcript'; msg: AsrMessage }
  | { type: 'event'; event: AudioEvent }
  | { type: 'renameSpeaker'; id: number; name: string }
  | { type: 'mergeSpeaker'; from: number; to: number }
  | { type: 'setMe'; name: string; aliases: string[] }
  | { type: 'setLedger'; items: LedgerItem[] }
  | { type: 'markSeen'; t: number }
  | { type: 'seedSpeakers'; names: Record<string, string> }
  | { type: 'markAddressed'; id: string }
  | { type: 'reset'; startedAt: number };

export function initSession(me: Session['me'] = { name: '', aliases: [] }, startedAt = Date.now()): SessionState {
  return { startedAt, me, speakers: {}, timeline: [], ledger: [], lastSeenAt: 0, merged: {} };
}

export const isUtt = (i: TimelineItem): i is Utterance => i.type === 'utterance';
export const itemT = (i: TimelineItem) => (isUtt(i) ? i.tStart : i.t);
const itemEnd = (i: TimelineItem) => (isUtt(i) ? i.tEnd : i.t);

export function speakerName(s: Pick<Session, 'speakers'>, id: number): string {
  if (id < 0) return 'Unknown';
  return s.speakers[id]?.name?.trim() || `Speaker ${id + 1}`;
}
export function speakerColor(s: Pick<Session, 'speakers'>, id: number): string {
  return id < 0 ? UNKNOWN_COLOR : s.speakers[id]?.color ?? UNKNOWN_COLOR;
}
/** Ledger/catch-up items reference speakers by display name; resolve back to a color. */
export function colorForName(s: Pick<Session, 'speakers'>, name?: string): string {
  if (!name) return UNKNOWN_COLOR;
  const n = name.trim().toLowerCase();
  for (const sp of Object.values(s.speakers)) {
    if (speakerName(s, sp.id).toLowerCase() === n) return sp.color;
  }
  return UNKNOWN_COLOR;
}

function ensureSpeaker(speakers: Record<number, Speaker>, id: number): Record<number, Speaker> {
  if (id < 0 || speakers[id]) return speakers;
  const used = new Set(Object.values(speakers).map((s) => s.color));
  const color = SPEAKER_COLORS.find((c) => !used.has(c)) ?? SPEAKER_COLORS[Object.keys(speakers).length % SPEAKER_COLORS.length];
  return { ...speakers, [id]: { id, color } };
}

function trimRing(timeline: TimelineItem[]): TimelineItem[] {
  if (!timeline.length) return timeline;
  let latest = 0;
  for (const i of timeline) latest = Math.max(latest, itemEnd(i));
  const cutoff = latest - RING_MS;
  if (itemEnd(timeline[0]) >= cutoff) return timeline;
  return timeline.filter((i) => itemEnd(i) >= cutoff);
}

function insertSorted(timeline: TimelineItem[], item: TimelineItem): TimelineItem[] {
  const t = itemT(item);
  let idx = timeline.length;
  while (idx > 0 && itemT(timeline[idx - 1]) > t) idx--;
  return [...timeline.slice(0, idx), item, ...timeline.slice(idx)];
}

function applyTranscript(s: SessionState, msg: Extract<AsrMessage, { type: 'transcript' }>): SessionState {
  const text = msg.text.trim();
  const speaker = msg.speaker >= 0 ? (s.merged[msg.speaker] ?? msg.speaker) : -1;
  const speakers = ensureSpeaker(s.speakers, speaker);
  // Interims are a per-speaker tail: a new interim replaces that speaker's interim;
  // any final clears every interim that started before it ended.
  const timeline = s.timeline.filter((i) => {
    if (!isUtt(i) || i.final) return true;
    if (i.speaker === speaker) return false;
    return !(msg.final && i.tStart <= msg.tEnd);
  });
  if (!text) return { ...s, speakers, timeline };
  const utt: Utterance = {
    id: `u${speaker}-${msg.tStart}${msg.final ? '' : '-i'}`,
    type: 'utterance', speaker, text, tStart: msg.tStart, tEnd: msg.tEnd, final: msg.final,
  };
  // Final duplicate guard (same id already present).
  const deduped = msg.final ? timeline.filter((i) => i.id !== utt.id) : timeline;
  return { ...s, speakers, timeline: trimRing(insertSorted(deduped, utt)) };
}

// ---- ledger merge: keep ids/order stable so cards replace in place, never reflow ----
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
export function textSimilarity(a: string, b: string): number {
  const A = new Set(norm(a)), B = new Set(norm(b));
  if (!A.size || !B.size) return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Server returns the FULL ledger: replace, but keep old ids + order for matched items (no reflow). */
export function mergeLedger(existing: LedgerItem[], incoming: LedgerItem[]): LedgerItem[] {
  const used = new Set<LedgerItem>();
  const out: LedgerItem[] = [];
  for (const old of existing) {
    const match = incoming.find((n) => !used.has(n) && n.kind === old.kind && (n.id === old.id || textSimilarity(n.text, old.text) >= 0.5));
    if (!match) continue; // gone from server ledger => drop
    used.add(match);
    out.push({ ...match, id: old.id });
  }
  for (const n of incoming) if (!used.has(n)) out.push(n);
  return out;
}

export function sessionReducer(s: SessionState, a: SessionAction): SessionState {
  switch (a.type) {
    case 'transcript':
      return a.msg.type === 'transcript' ? applyTranscript(s, a.msg) : s;
    case 'event':
      if (s.timeline.some((i) => i.id === a.event.id)) return s;
      return { ...s, timeline: trimRing(insertSorted(s.timeline, a.event)) };
    case 'renameSpeaker': {
      const sp = s.speakers[a.id];
      if (!sp) return s;
      const name = a.name.trim() || undefined;
      return { ...s, speakers: { ...s.speakers, [a.id]: { ...sp, name } } };
    }
    case 'mergeSpeaker': {
      const { from, to } = a;
      if (from === to || !s.speakers[to]) return s;
      const speakers = { ...s.speakers };
      delete speakers[from];
      const merged: Record<number, number> = { ...s.merged, [from]: to };
      for (const k of Object.keys(merged)) if (merged[+k] === from) merged[+k] = to;
      const timeline = s.timeline.map((i) => (isUtt(i) && i.speaker === from ? { ...i, speaker: to } : i));
      return { ...s, speakers, merged, timeline };
    }
    case 'setMe':
      return { ...s, me: { name: a.name.trim(), aliases: a.aliases.map((x) => x.trim()).filter(Boolean) } };
    case 'setLedger':
      return { ...s, ledger: mergeLedger(s.ledger, a.items) };
    case 'markSeen':
      return { ...s, lastSeenAt: Math.max(s.lastSeenAt, a.t) };
    case 'seedSpeakers': {
      let speakers = s.speakers;
      for (const [k, name] of Object.entries(a.names)) {
        const id = Number(k);
        if (!Number.isInteger(id) || id < 0) continue;
        speakers = ensureSpeaker(speakers, id);
        if (!speakers[id].name) speakers = { ...speakers, [id]: { ...speakers[id], name } };
      }
      return { ...s, speakers };
    }
    case 'markAddressed':
      return { ...s, timeline: s.timeline.map((i) => (i.id === a.id && isUtt(i) ? { ...i, addressedToMe: true } : i)) };
    case 'reset':
      return initSession(s.me, a.startedAt);
  }
}

// ---- selectors ----
export function windowSince(s: Pick<Session, 'timeline'>, t: number, finalOnly = true): TimelineItem[] {
  return s.timeline.filter((i) => itemEnd(i) >= t && (!finalOnly || !isUtt(i) || i.final));
}
export function latestT(s: Pick<Session, 'timeline'>): number {
  let m = 0;
  for (const i of s.timeline) m = Math.max(m, itemEnd(i));
  return m;
}
export function lastMinutes(s: Pick<Session, 'timeline'>, n: number, nowT = latestT(s)): TimelineItem[] {
  return windowSince(s, nowT - n * 60_000);
}
export function around(s: Pick<Session, 'timeline'>, t: number, spanMs = 15_000): TimelineItem[] {
  return s.timeline.filter((i) => itemEnd(i) >= t - spanMs && itemT(i) <= t + spanMs && (!isUtt(i) || i.final));
}
/** Latest utterance (interim or final) — drives the Now card. */
export function currentUtterance(s: Pick<Session, 'timeline'>): Utterance | undefined {
  for (let k = s.timeline.length - 1; k >= 0; k--) {
    const i = s.timeline[k];
    if (isUtt(i)) return i;
  }
  return undefined;
}
