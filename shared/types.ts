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

// POST /api/interject — "Speak for me": draft short spoken lines so ME can re-enter the conversation
export type InterjectIntent = 'object'|'question'|'clarify'|'agree'|'custom';
export interface InterjectRequest {
  me: Session['me']; speakers: Record<number, Speaker>;
  window: TimelineItem[];            // last ~60s is used
  ledger: LedgerItem[];
  intent?: InterjectIntent;          // omitted => mix of the most useful kinds
  custom?: string;                   // with intent 'custom' (or alone): polish into one spoken line
}
export interface InterjectOption { label: string; line: string; kind: string } // kind: InterjectIntent
export interface InterjectResponse { options: InterjectOption[]; latencyMs?: number } // <=3
/** Speaker id used for lines ME spoke via "Speak for me" (text-to-speech). */
export const ME_SPEAKER_ID = -2;

// ---------- WS /ws/audio ----------
// client -> server: binary frames = 16kHz mono PCM16 LE. text frame {"type":"stop"}.
// server -> client: JSON messages:
export type AsrMessage =
  // name: set when the line came from an "Everyone joins" participant phone (speaker = stable per-name id >= 100)
  | { type: 'transcript'; speaker: number; text: string; tStart: number; tEnd: number; final: boolean; name?: string }
  | { type: 'status'; state: 'connecting'|'open'|'closed'|'error'; detail?: string }
  // host only: who is connected via /join.html (sent on join/leave/speaking change)
  | { type: 'participants'; list: Participant[] }
  // participant phones only, every 2s: THIS speaker's pace (rolling 20s, words/min of speech) + table-wide overlap
  | { type: 'pace'; wpm: number; level: PaceLevel; overlap: boolean; listenerName: string }
  // hosts only, every 2s while phones are joined: table-wide overlap + mean wpm of recently active speakers
  | { type: 'table'; overlap: boolean; avgWpm: number };

/** DHH caption comprehension drops above ~170 wpm: ok <150, fast 150-170, too_fast >170. */
export type PaceLevel = 'ok'|'fast'|'too_fast';
export const PACE_FAST_WPM = 150;
export const PACE_TOO_FAST_WPM = 170;
export const paceLevel = (wpm: number): PaceLevel => (wpm > PACE_TOO_FAST_WPM ? 'too_fast' : wpm >= PACE_FAST_WPM ? 'fast' : 'ok');
// POST /api/room/me {name}: the host's own name, shown on phones ("Good pace for Bera")

// "Everyone joins" mode: WS /ws/audio?role=participant&name=Alex&token=... ; GET /api/room -> RoomInfo
export interface Participant { id: number; name: string; speaking: boolean }
export interface RoomInfo { token: string; joinUrl: string }

export const SPEAKER_COLORS = ['#3B82F6','#F59E0B','#10B981','#EC4899','#8B5CF6','#EF4444','#14B8A6','#F97316'];
export const fmtT = (ms: number) => { const s = Math.floor(ms/1000); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };
