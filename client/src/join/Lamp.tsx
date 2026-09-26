// The lamp: the whole phone screen is one color with one word, readable from across the table.
// green = go ahead, amber = one at a time / slower, red = too fast. The owner's name small on top.
import type { PaceLevel } from '../../../shared/types';

export interface LampPace { wpm: number; level: PaceLevel; overlap: boolean }
type Tone = 'good' | 'amber' | 'red' | 'idle';

// design/BRAND.md v2. Text on each: cream on green/red (large text only), ink on amber and cream.
const BG: Record<Tone, string> = { good: '#4F8A5B', amber: '#E0A63A', red: '#B4432F', idle: '#F5EFE4' };
const FG: Record<Tone, string> = { good: '#F5EFE4', amber: '#1B1611', red: '#F5EFE4', idle: '#1B1611' };

export function lampState(pace: LampPace | null, muted: boolean, host: string): { tone: Tone; word: string; line: string } {
  if (muted) return { tone: 'idle', word: 'Muted', line: 'The table can’t hear you' };
  if (pace?.level === 'too_fast') return { tone: 'red', word: 'Too fast', line: `Too fast for ${host}` };
  if (pace?.overlap) return { tone: 'amber', word: 'One at a time', line: `One at a time helps ${host}` };
  if (pace?.level === 'fast') return { tone: 'amber', word: 'Slower', line: `Slower helps ${host}` };
  return { tone: 'good', word: 'Go ahead', line: `${host} can follow you` };
}

export function Lamp({ pace, muted, host, name, status, onTap }: {
  pace: LampPace | null; muted: boolean; host: string; name: string; status?: string; onTap: () => void;
}) {
  const st = lampState(pace, muted, host);
  return (
    <button type="button" onClick={onTap} data-testid="lamp" data-tone={st.tone}
      aria-label={`${st.word}. ${st.line}. Tap for mute and leave.`}
      className="fixed inset-0 z-30 flex cursor-pointer flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-left transition-colors duration-200"
      style={{ background: BG[st.tone], color: FG[st.tone] }}>
      <span className="flex w-full items-baseline justify-between gap-3">
        <span className="truncate text-[1.05rem] font-bold">{name}</span>
        {status && <span className="shrink-0 font-mono text-[13px] opacity-90">{status}</span>}
      </span>
      <span className="my-auto block w-full">
        <span key={st.word} className="oat-in block font-display-italic text-[clamp(3.6rem,19vw,6.5rem)] leading-[0.95]" role="status" aria-live="polite">{st.word}</span>
        <span className="mt-5 block text-[1.35rem] leading-snug font-bold">{st.line}</span>
      </span>
    </button>
  );
}
