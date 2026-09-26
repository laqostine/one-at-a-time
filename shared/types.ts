// SHARED CONTRACT — every module imports from here. Do not fork these types.
export interface Speaker { id: number; name?: string; color: string }

export interface Utterance {
  id: string; type: 'utterance';
  speaker: number;            // diarization id from ASR (-1 = unknown)
  text: string;
  tStart: number; tEnd: number; // ms since session start
  final: boolean;
  addressedToMe?: boolean;
}

export type EventKind = 'laughter'|'applause'|'cheering'|'alarm'|'doorbell'|'knock'|'phone'|'music';
export interface AudioEvent { id: string; type: 'event'; kind: EventKind; t: number; score: number }

export type TimelineItem = Utterance | AudioEvent;

export type LedgerKind = 'decision'|'objection'|'open_question'|'assigned_to_me'|'instruction_change';
// thread: short label of the conversation thread this belongs to (e.g. "Friday launch"); replyTo: who this was responding to
export interface LedgerItem { id: string; kind: LedgerKind; text: string; speaker?: string; t: number; resolved?: boolean; reason?: string; thread?: string; replyTo?: string }

export interface Session {
  startedAt: number;
  me: { name: string; aliases: string[] };
  speakers: Record<number, Speaker>;
  timeline: TimelineItem[];   // ring buffer, last 15 min
  ledger: LedgerItem[];
  lastSeenAt: number;         // ms since session start
}

// ---------- Server API ----------
// POST /api/catchup
export interface CatchupRequest { me: Session['me']; speakers: Record<number, Speaker>; window: TimelineItem[]; sinceT: number; nowT: number }
export interface CatchupBullet { text: string; kind: 'decision_in_progress'|'objection'|'open_question'|'joke'|'event'|'info'|'instruction_change'; speaker?: string; t?: number; thread?: string; replyTo?: string }
export interface CatchupResponse {
  addressed_to_me: { speaker: string; question: string; t: number } | null;
  bullets: CatchupBullet[];      // <=3
  open_threads: string[];        // <=3
  confidence: 'low'|'medium'|'high';
  latencyMs?: number;
}

// POST /api/state
export interface StateRequest { me: Session['me']; speakers: Record<number, Speaker>; window: TimelineItem[]; nowT: number; existing: LedgerItem[] }
export interface StateResponse { ledger: LedgerItem[]; addressed_to_me_now: { speaker: string; question: string; t: number } | null; latencyMs?: number }

// POST /api/laugh  (stretch)
export interface LaughRequest { speakers: Record<number, Speaker>; window: TimelineItem[]; t: number }
export interface LaughResponse { line: string | null }

// ---------- WS /ws/audio ----------
// client -> server: binary frames = 16kHz mono PCM16 LE. text frame {"type":"stop"}.
// server -> client: JSON messages:
export type AsrMessage =
  | { type: 'transcript'; speaker: number; text: string; tStart: number; tEnd: number; final: boolean }
  | { type: 'status'; state: 'connecting'|'open'|'closed'|'error'; detail?: string };

export const SPEAKER_COLORS = ['#3B82F6','#F59E0B','#10B981','#EC4899','#8B5CF6','#EF4444','#14B8A6','#F97316'];
export const fmtT = (ms: number) => { const s = Math.floor(ms/1000); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };
