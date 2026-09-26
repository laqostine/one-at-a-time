import { useEffect, useReducer } from 'react';
import { Settings, Pause, Play, Users } from 'lucide-react';
import type { SessionApi } from '../state/useSession';
import { Presence, type PresenceState } from './Presence';

interface Props {
  asr: SessionApi['asr'];
  latency: SessionApi['latency'];
  listening: boolean;
  onToggleListening: () => void;
  onSettings: () => void;
  /** "Everyone joins" button (optional) */
  onEveryoneJoins?: () => void;
  participantCount?: number;
  /** Presence indicator inputs (from useSession). */
  lastTranscriptAt: number;
  requestPending: boolean;
  micLevel: number;
  /** Optional: set by a future useInterject hook when the assistant is talking over TTS. */
  speaking?: boolean;
}

function statusText(asr: Props['asr'], listening: boolean): { text: string; tone: string } {
  if (!listening || asr.state === 'paused') return { text: 'Paused', tone: 'bg-muted' };
  const src = asr.source === 'replay' ? 'Replay' : asr.source === 'webspeech' ? 'Captions only' : 'Listening';
  switch (asr.state) {
    case 'open': return { text: src, tone: 'bg-bad' };
    case 'connecting': case 'idle': return { text: 'Connecting…', tone: 'bg-warn' };
    case 'closed': return { text: 'Disconnected', tone: 'bg-muted' };
    case 'error': return { text: asr.detail ? `Error: ${asr.detail}` : 'Mic error', tone: 'bg-warn' };
    default: return { text: src, tone: 'bg-muted' };
  }
}

const fmtMs = (ms?: number) => (ms == null ? '–' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

const TRANSCRIBING_WINDOW_MS = 1500;
const REPLAY_LEVEL_WINDOW_MS = 300;

/** State derivation: pending request wins (assistant is thinking), then an explicit
 * speaking flag (future useInterject hook), then ASR status + transcript recency. */
function derivePresenceState(
  asr: Props['asr'],
  listening: boolean,
  lastTranscriptAt: number,
  requestPending: boolean,
  speaking: boolean | undefined,
  now: number,
): PresenceState {
  if (speaking) return 'speaking';
  if (requestPending) return 'thinking';
  if (!listening || asr.state === 'closed' || asr.state === 'error' || asr.state === 'paused') return 'idle';
  if (asr.state === 'open') {
    return now - lastTranscriptAt < TRANSCRIBING_WINDOW_MS ? 'transcribing' : 'listening';
  }
  return 'idle'; // connecting / idle
}

function deriveLevel(asr: Props['asr'], lastTranscriptAt: number, micLevel: number, now: number): number {
  if (asr.source === 'replay') return now - lastTranscriptAt < REPLAY_LEVEL_WINDOW_MS ? 1 : 0;
  if (asr.source === 'mic') return micLevel;
  return 0; // webspeech fallback carries no level signal
}

export function Header({
  asr, latency, listening, onToggleListening, onSettings, onEveryoneJoins, participantCount = 0,
  lastTranscriptAt, requestPending, micLevel, speaking,
}: Props) {
  const s = statusText(asr, listening);

  // The transcribing/listening split and the replay "fake level" both decay with wall-clock
  // time rather than on a new message, so tick every 300ms to keep them honest.
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = window.setInterval(tick, 300);
    return () => window.clearInterval(id);
  }, []);

  const now = Date.now();
  const presenceState = derivePresenceState(asr, listening, lastTranscriptAt, requestPending, speaking, now);
  const presenceLevel = deriveLevel(asr, lastTranscriptAt, micLevel, now);

  return (
    <header className="flex items-center gap-3 px-3 pt-2 pb-1">
      <Presence size={28} state={presenceState} level={presenceLevel} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.95rem] font-semibold" role="status">{s.text}</div>
        <div className="truncate text-[0.75rem] text-muted tabular-nums">
          {asr.source === 'webspeech' && listening ? 'no speaker colors · ' : ''}
          ledger {latency.stateError ? 'offline' : fmtMs(latency.stateMs)} · catch-up {fmtMs(latency.catchupMs)}
        </div>
      </div>
      {onEveryoneJoins && (
        <button type="button" onClick={onEveryoneJoins} aria-label={`Everyone joins (${participantCount} connected)`} title="Everyone joins"
          className="relative rounded-xl p-2.5 text-muted hover:bg-card-2 hover:text-fg">
          <Users size={22} aria-hidden />
          {participantCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-accent px-1 text-center text-[0.7rem] font-bold text-black">{participantCount}</span>
          )}
        </button>
      )}
      <button type="button" onClick={onToggleListening}
        aria-label={listening ? 'Pause listening' : 'Resume listening'}
        className="rounded-xl p-2.5 text-muted hover:bg-card-2 hover:text-fg">
        {listening ? <Pause size={22} aria-hidden /> : <Play size={22} aria-hidden />}
      </button>
      <button type="button" onClick={onSettings} aria-label="Settings"
        className="rounded-xl p-2.5 text-muted hover:bg-card-2 hover:text-fg">
        <Settings size={22} aria-hidden />
      </button>
    </header>
  );
}
