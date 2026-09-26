// The lamp (design/DESIGN.md §2): the whole phone screen is one flat color with one word.
// --go "Go ahead" · --amber "One at a time" (overlap) · --amber "Slower" (fast) · --stop "Too fast".
import type { PaceLevel } from '../../../shared/types';

export interface LampPace { wpm: number; level: PaceLevel; overlap: boolean }
export type Tone = 'good' | 'amber' | 'red' | 'idle';

const BG: Record<Tone, string> = { good: 'var(--go)', amber: 'var(--amber)', red: 'var(--stop)', idle: 'var(--cream)' };
// Big word: cream on color, ink on cream. Small text (<=24px) on amber is ink (contrast).
const WORD: Record<Tone, string> = { good: 'var(--cream)', amber: 'var(--cream)', red: 'var(--cream)', idle: 'var(--ink)' };
const SMALL: Record<Tone, string> = { good: 'var(--cream)', amber: 'var(--ink)', red: 'var(--cream)', idle: 'var(--ink-2)' };

export function lampTone(pace: LampPace | null, muted: boolean): Tone {
  if (muted) return 'idle';
  if (pace?.level === 'too_fast') return 'red';
  if (pace?.overlap || pace?.level === 'fast') return 'amber';
  return 'good';
}

export function lampState(pace: LampPace | null, muted: boolean, host: string): { tone: Tone; word: string; line: string } {
  const tone = lampTone(pace, muted);
  if (muted) return { tone, word: 'Muted', line: 'the table can’t hear you' };
  if (tone === 'red') return { tone, word: 'Too fast', line: `slower helps ${host}` };
  if (pace?.overlap) return { tone, word: 'One at a time', line: `one at a time helps ${host}` };
  if (tone === 'amber') return { tone, word: 'Slower', line: `slower helps ${host}` };
  return { tone, word: 'Go ahead', line: '' };
}

export function Lamp({ pace, muted, host, name, status, onTap }: {
  pace: LampPace | null; muted: boolean; host: string; name: string; status?: string; onTap: () => void;
}) {
  const st = lampState(pace, muted, host);
  return (
    <button type="button" onClick={onTap} data-testid="lamp" data-tone={st.tone}
      aria-label={`${st.word}. ${st.line ? `${st.line}. ` : ''}Tap for mute and leave.`}
      className="fixed inset-0 z-30 flex cursor-pointer flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.75rem,env(safe-area-inset-bottom))] text-left transition-colors duration-200"
      style={{ background: BG[st.tone] }}>
      <span className="oat-label" style={{ color: SMALL[st.tone] }}>{name}{status ? ` · ${status}` : ''}</span>
      <span key={st.word} className="oat-in my-auto block w-full text-center font-display-italic text-[56px] leading-[1.02]"
        style={{ color: WORD[st.tone] }} role="status" aria-live="polite">{st.word}</span>
      <span className="min-h-6 text-[17px] font-medium" style={{ color: SMALL[st.tone], opacity: st.tone === 'red' ? 0.85 : 1 }}>{st.line}</span>
    </button>
  );
}
