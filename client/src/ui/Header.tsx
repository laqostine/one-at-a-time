import type { ReactNode } from 'react';
import { useEffect, useReducer, useState, useSyncExternalStore } from 'react';
import { ChevronDown, Settings, Pause, Play } from 'lucide-react';
import type { SessionApi } from '../state/useSession';
import type { PresenceState } from './Presence';
import { PresenceAuto } from './PresenceAuto';
import { ColorLegend } from './ColorLegend';
import { TableRing, type Seat } from './TableRing';
import { IconTable } from './icons';
import { PRESENCE_HEX, PRESENCE_WORD } from './presenceStates';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { LevelDots } from './LevelDots';
import { ObjIcon } from './ObjIcon';

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
  /** Increment to flare the presence amber (something was just aimed at you). */
  flare?: number;
  /** Table ring seats: joined phones, or diarized voices when nobody joined. */
  seats?: Seat[];
  seatSource?: 'phones' | 'voices';
  /** Desktop top bar: the table lamp pill. */
  lamp?: ReactNode;
}

function statusText(asr: Props['asr'], listening: boolean): { text: string; tone: string } {
  if (!listening || asr.state === 'paused') return { text: 'Paused', tone: 'bg-muted' };
  const src = asr.source === 'replay' ? 'Replay' : asr.source === 'webspeech' ? 'Captions only' : 'Live mic';
  switch (asr.state) {
    case 'open': return { text: src, tone: 'bg-bad' };
    case 'connecting': case 'idle': return { text: 'Connecting…', tone: 'bg-warn' };
    case 'closed': return { text: 'Disconnected', tone: 'bg-muted' };
    case 'error': return { text: asr.detail ? `Error: ${asr.detail}` : 'Mic error', tone: 'bg-warn' };
    default: return { text: src, tone: 'bg-muted' };
  }
}

export const fmtMs = (ms?: number) => (ms == null ? '–' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

const TRANSCRIBING_WINDOW_MS = 1500;
const REPLAY_LEVEL_WINDOW_MS = 300;
const FLARE_LABEL_MS = 2200;

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

export function useMedia(q: string, ssr = true): boolean {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(q); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => window.matchMedia(q).matches,
    () => ssr,
  );
}
export const LG = '(min-width: 1024px)';

/** Presence state, level and the "asked you" flare window; ticks every 300 ms because the
 * transcribing/listening split and the replay "fake level" decay with wall-clock time. */
function usePresenceModel({ asr, listening, lastTranscriptAt, requestPending, micLevel, speaking, flare = 0 }: Props) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = window.setInterval(tick, 300);
    return () => window.clearInterval(id);
  }, []);
  const [flaredAt, setFlaredAt] = useState(0);
  useEffect(() => { if (flare > 0) setFlaredAt(Date.now()); }, [flare]);
  const now = Date.now();
  return {
    state: derivePresenceState(asr, listening, lastTranscriptAt, requestPending, speaking, now),
    level: deriveLevel(asr, lastTranscriptAt, micLevel, now),
    flaring: now - flaredAt < FLARE_LABEL_MS,
    live: listening && asr.state === 'open',
    status: statusText(asr, listening),
  };
}

const iconBtn = 'relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted transition-colors duration-150 hover:bg-card-2 hover:text-fg';

function Controls({ listening, onToggleListening, onSettings, onEveryoneJoins, participantCount = 0, badge }: Props) {
  return (
    <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
      {badge}
      {onEveryoneJoins && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={onEveryoneJoins} aria-label={`Everyone joins (${participantCount} connected)`}
              className="lift relative flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 text-[0.9rem] font-semibold text-fg transition-colors duration-150 hover:border-input hover:bg-card-2 sm:gap-2 sm:px-3">
              <ObjIcon name="table" fallback={IconTable} size={34} className="-my-2 -ml-1" />
              <span className="hidden md:inline">Everyone joins</span>
              <span className={`min-w-6 rounded-full px-1.5 text-center font-mono text-[0.75rem] leading-6 font-bold tabular-nums ${participantCount > 0 ? 'bg-accent text-accent-fg' : 'bg-card-2 text-muted'}`}>{participantCount}</span>
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
    </div>
  );
}

const Wordmark = ({ className }: { className?: string }) =>
  <a href="/landing.html" className={cn('wordmark block w-fit rounded-sm text-[1.35rem] sm:text-[1.45rem]', className)}>I Missed That</a>;

function StateWord({ state, flaring, className }: { state: PresenceState; flaring: boolean; className?: string }) {
  return (
    <span className={cn('font-display-italic leading-none whitespace-nowrap transition-colors duration-300', className)}
      style={{ color: flaring ? 'var(--warn)' : `color-mix(in oklab, ${PRESENCE_HEX[state]} 55%, var(--fg))` }}>
      {flaring ? 'Asked you' : PRESENCE_WORD[state]}
    </span>
  );
}

function StatusLine({ p, latency, asr, listening, quiet = false }: { p: ReturnType<typeof usePresenceModel>; latency: Props['latency']; asr: Props['asr']; listening: boolean; quiet?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${p.status.tone} ${p.live ? 'imt-pulse' : ''}`} />
      <span className="min-w-0 truncate font-mono text-[0.72rem] font-medium tracking-wider text-muted uppercase" role="status">{p.status.text}</span>
      {/* Latency chips live here on tablets/desktop; on phones they move into Settings so the status can breathe. */}
      <span className={cn('hidden min-w-0 items-center gap-1.5 overflow-hidden font-mono tabular-nums', quiet ? '2xl:flex' : 'sm:flex')}>
        {asr.source === 'webspeech' && listening && <Badge variant="outline" className="text-warn">no speaker colors</Badge>}
        <Badge variant="outline" className={latency.stateError ? 'text-warn' : 'text-muted'} title="Time for the ledger to update">
          ledger {latency.stateError ? 'offline' : fmtMs(latency.stateMs)}
        </Badge>
        <Badge variant="outline" className="text-muted" title="Time for the last catch-up">catch-up {fmtMs(latency.catchupMs)}</Badge>
      </span>
    </div>
  );
}

/**
 * Phones + tablets (<1024px): the presence bar. The mascot is the hero of the screen
 * (112px phone / 140px tablet) with its state as a word, a legend of its colors and the table ring.
 */
export function Header(props: Props) {
  const { seats = [], seatSource = 'voices', flare = 0 } = props;
  const p = usePresenceModel(props);
  const wide = useMedia('(min-width: 640px)');
  const [legendOpen, setLegendOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={300}>
    <header className="shrink-0 px-3 pt-2 pb-1 sm:px-4 sm:pt-3 sm:pb-2" aria-label="I Missed That: status">
      {/* phones: wordmark + controls on their own row, so nothing truncates */}
      <div className="flex h-12 items-center justify-between gap-2 sm:hidden">
        <Wordmark />
        <Controls {...props} />
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="-my-1 flex shrink-0 flex-col items-center">
          <PresenceAuto size={wide ? 140 : 96} state={p.state} level={p.level} flare={flare} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="hidden items-start justify-between gap-3 sm:flex">
            <Wordmark />
            <Controls {...props} />
          </div>
          <div className="sm:mt-1"><StateWord state={p.state} flaring={p.flaring} className="text-[2rem] sm:text-[2.6rem]" /></div>
          <div className="mt-1.5"><StatusLine p={p} latency={props.latency} asr={props.asr} listening={props.listening} /></div>
          {wide ? (
            <ColorLegend current={p.state} flaring={p.flaring} className="mt-2.5" />
          ) : (
            <button type="button" onClick={() => setLegendOpen((o) => !o)} aria-expanded={legendOpen} aria-controls="imt-legend"
              className="mt-1.5 -ml-1 flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-1 font-mono text-[0.68rem] tracking-wider text-muted uppercase transition-colors hover:text-fg">
              <span aria-hidden className="flex -space-x-0.5">
                {(['idle', 'listening', 'transcribing', 'thinking', 'speaking'] as const).map((k) => (
                  <span key={k} className="size-2 rounded-full ring-1 ring-bg" style={{ background: PRESENCE_HEX[k] }} />
                ))}
              </span>
              Colors
              <ChevronDown size={14} aria-hidden className={cn('transition-transform duration-150', legendOpen && 'rotate-180')} />
            </button>
          )}
        </div>
        {wide && <TableRing seats={seats} source={seatSource} size={112} />}
      </div>
      {!wide && legendOpen && <ColorLegend id="imt-legend" current={p.state} flaring={p.flaring} className="mt-1 mb-1 px-1" />}
    </header>
    </TooltipProvider>
  );
}

/** Desktop (>=1024px) top bar: wordmark, connection status + latency, controls. */
export function DesktopTop(props: Props) {
  const p = usePresenceModel(props);
  return (
    <TooltipProvider delayDuration={300}>
      <header className="flex h-16 shrink-0 items-center gap-5 px-1" aria-label="I Missed That: status">
        <Wordmark className="text-[1.6rem]!" />
        <span aria-hidden className="h-5 w-px bg-line" />
        {/* the table view keeps the bar quiet: latency chips only on very wide screens (always in Settings) */}
        <div className="min-w-0 flex-1"><StatusLine p={p} latency={props.latency} asr={props.asr} listening={props.listening} quiet /></div>
        {props.lamp}
        <Controls {...props} />
      </header>
    </TooltipProvider>
  );
}

/** Desktop bento hero cell: the mascot large, its state word, the dotted listening waveform,
 * the color legend and the table ring. */
export function PresenceCell(props: Props & { className?: string }) {
  const { seats = [], seatSource = 'voices', flare = 0, className } = props;
  const p = usePresenceModel(props);
  const hex = p.flaring ? 'var(--warn)' : PRESENCE_HEX[p.state];
  return (
    <section aria-label="What the clerk is doing" className={cn('surface-hero relative flex min-h-0 flex-col overflow-hidden rounded-3xl p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="card-label">Clerk</span>
        <TableRing seats={seats} source={seatSource} size={88} />
      </div>
      <div className="-mt-10 flex flex-1 flex-col items-center justify-center">
        <PresenceAuto size={176} state={p.state} level={p.level} flare={flare} />
        <StateWord state={p.state} flaring={p.flaring} className="mt-1 text-[2.4rem]" />
        <LevelDots level={p.level} active={p.state === 'listening' || p.state === 'transcribing' || p.state === 'speaking'} color={hex} className="mt-3" />
      </div>
      <ColorLegend current={p.state} flaring={p.flaring} className="mt-3 justify-center border-t border-line/70 pt-3" />
    </section>
  );
}

/** Desktop table: the mascot sitting at the head of the table, with its state word. */
export function TableHead(props: Props & { size?: number }) {
  const p = usePresenceModel(props);
  return (
    <div className="flex flex-col items-center" aria-label={`The clerk: ${p.flaring ? 'asked you' : PRESENCE_WORD[p.state]}`} role="status">
      <PresenceAuto size={props.size ?? 112} state={p.state} level={p.level} flare={props.flare ?? 0} />
      <StateWord state={p.state} flaring={p.flaring} className="-mt-2 text-[1.6rem] drop-shadow-[0_2px_6px_rgb(0_0_0/.8)]" />
    </div>
  );
}

/** Desktop: the mascot's color legend, under the table. */
export function TableLegend(props: Props & { className?: string }) {
  const p = usePresenceModel(props);
  return <ColorLegend current={p.state} flaring={p.flaring} className={props.className} />;
}
