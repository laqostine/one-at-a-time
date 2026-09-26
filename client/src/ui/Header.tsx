import type { ReactNode } from 'react';
import { useEffect, useReducer } from 'react';
import { Settings, Pause, Play, Users } from 'lucide-react';
import type { SessionApi } from '../state/useSession';
import type { PresenceState } from './Presence';
import { PresenceAuto } from './PresenceAuto';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  /** Extra status badge (e.g. look-away camera indicator + "Away" pill). */
  badge?: ReactNode;
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
  lastTranscriptAt, requestPending, micLevel, speaking, badge,
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

  const live = listening && asr.state === 'open';
  const iconBtn = 'relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted transition-colors duration-150 hover:bg-card-2 hover:text-fg';

  return (
    <TooltipProvider delayDuration={300}>
    <header className="flex h-[84px] shrink-0 items-center gap-2 px-3 sm:gap-3 sm:px-4">
      <PresenceAuto size={72} state={presenceState} level={presenceLevel} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.tone} ${live ? 'imt-pulse' : ''}`} />
          <span className="truncate text-[1rem] font-semibold" role="status">{s.text}</span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden tabular-nums">
          {asr.source === 'webspeech' && listening && <Badge variant="outline" className="text-warn">no speaker colors</Badge>}
          <Badge variant="outline" className={latency.stateError ? 'text-warn' : 'text-muted'} title="Time for the ledger to update">
            ledger {latency.stateError ? 'offline' : fmtMs(latency.stateMs)}
          </Badge>
          <Badge variant="outline" className="text-muted" title="Time for the last catch-up">catch-up {fmtMs(latency.catchupMs)}</Badge>
        </div>
      </div>
      {badge}
      {onEveryoneJoins && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={onEveryoneJoins} aria-label={`Everyone joins (${participantCount} connected)`}
              className="relative flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 text-[0.9rem] font-semibold text-fg transition-colors duration-150 hover:border-input hover:bg-card-2">
              <Users size={20} aria-hidden className="text-accent" />
              <span className="hidden sm:inline">Everyone joins</span>
              <span className={`min-w-6 rounded-full px-1.5 text-center text-[0.75rem] leading-6 font-bold tabular-nums ${participantCount > 0 ? 'bg-accent text-accent-fg' : 'bg-card-2 text-muted'}`}>{participantCount}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>Show the QR so everyone's phone becomes their mic</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={onToggleListening}
            aria-label={listening ? 'Pause listening' : 'Resume listening'} className={iconBtn}>
            {listening ? <Pause size={22} aria-hidden /> : <Play size={22} aria-hidden />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{listening ? 'Pause listening' : 'Resume listening'}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={onSettings} aria-label="Settings" className={iconBtn}>
            <Settings size={22} aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent>Settings</TooltipContent>
      </Tooltip>
    </header>
    </TooltipProvider>
  );
}
