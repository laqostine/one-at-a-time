import { Settings, Pause, Play } from 'lucide-react';
import type { SessionApi } from '../state/useSession';

interface Props {
  asr: SessionApi['asr'];
  latency: SessionApi['latency'];
  listening: boolean;
  onToggleListening: () => void;
  onSettings: () => void;
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

export function Header({ asr, latency, listening, onToggleListening, onSettings }: Props) {
  const s = statusText(asr, listening);
  const live = listening && asr.state === 'open';
  return (
    <header className="flex items-center gap-3 px-3 pt-2 pb-1">
      <span aria-hidden className={`h-3 w-3 shrink-0 rounded-full ${s.tone} ${live ? 'imt-pulse' : ''}`} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.95rem] font-semibold" role="status">{s.text}</div>
        <div className="truncate text-[0.75rem] text-muted tabular-nums">
          {asr.source === 'webspeech' && listening ? 'no speaker colors · ' : ''}
          ledger {latency.stateError ? 'offline' : fmtMs(latency.stateMs)} · catch-up {fmtMs(latency.catchupMs)}
        </div>
      </div>
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
