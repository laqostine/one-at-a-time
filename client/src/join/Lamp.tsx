// The lamp (design/DESIGN.md §2): the whole phone screen is one flat color with one word.
// Two colors only: --go "Go ahead" · --amber "One at a time" (overlap) or "Slower" (fast / too fast). No red.
import type { PaceLevel, Tone as VoiceTone } from '../../../shared/types';

/** Host-computed mood (`mood` message): the table's, and this speaker's own tone (positive tones only). */
export interface LampMood { table: 'warm' | 'tense' | 'light' | 'quiet'; mine?: VoiceTone | 'light' }

export interface LampPace { wpm: number; level: PaceLevel; overlap: boolean }
export type Tone = 'good' | 'amber' | 'idle';

const BG: Record<Tone, string> = { good: 'var(--go)', amber: 'var(--amber)', idle: 'var(--cream)' };
// Big word: cream on color, ink on cream. Small text (<=24px) on amber is ink (contrast).
const WORD: Record<Tone, string> = { good: 'var(--cream)', amber: 'var(--cream)', idle: 'var(--ink)' };
const SMALL: Record<Tone, string> = { good: 'var(--cream)', amber: 'var(--ink)', idle: 'var(--ink-2)' };

export function lampTone(pace: LampPace | null, muted: boolean): Tone {
  if (muted) return 'idle';
  if (pace?.overlap || pace?.level === 'fast' || pace?.level === 'too_fast') return 'amber';
  return 'good';
}

export function lampState(pace: LampPace | null, muted: boolean, host: string): { tone: Tone; word: string; line: string } {
  const tone = lampTone(pace, muted);
  if (muted) return { tone, word: 'Muted', line: 'the table can’t hear you' };
  if (pace?.overlap) return { tone, word: 'One at a time', line: `one at a time helps ${host}` };
  if (tone === 'amber') return { tone, word: 'Slower', line: `slower helps ${host}` };
  return { tone, word: 'Go ahead', line: '' };
}

export function Lamp({ pace, muted, host, name, status, mood, onTap }: {
  pace: LampPace | null; muted: boolean; host: string; name: string; status?: string; mood?: LampMood | null; onTap: () => void;
}) {
  const st = lampState(pace, muted, host);
  const moodLines = [
    mood && mood.table !== 'quiet' ? `the table feels ${mood.table}` : '',
    mood?.mine && mood.mine !== 'neutral' ? `you sound ${mood.mine}` : '',
  ].filter(Boolean);
  return (
    <button type="button" onClick={onTap} data-testid="lamp" data-tone={st.tone}
      aria-label={`${st.word}. ${st.line ? `${st.line}. ` : ''}Tap for mute and leave.`}
      className="fixed inset-0 z-30 flex cursor-pointer flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.75rem,env(safe-area-inset-bottom))] text-left transition-colors duration-200"
      style={{ background: BG[st.tone] }}>
      <span className="oat-label" style={{ color: SMALL[st.tone] }}>{name}{status ? ` · ${status}` : ''}</span>
      <span className="my-auto block w-full text-center">
        <span key={st.word} className="oat-in block font-display-italic text-[56px] leading-[1.02]"
          style={{ color: WORD[st.tone] }} role="status" aria-live="polite">{st.word}</span>
        {moodLines.map((l) => (
          <span key={l} className="oat-fade mt-3 block font-mono text-[12px] font-medium tracking-[.14em] uppercase" data-testid="lamp-mood"
            style={{ color: SMALL[st.tone], opacity: st.tone === 'amber' ? 1 : 0.8 }}>{l}</span>
        ))}
      </span>
      <span className="min-h-6 text-[17px] font-medium" style={{ color: SMALL[st.tone] }}>{st.line}</span>
    </button>
  );
}
