// Lamp mode: the whole phone screen becomes a colored lamp, face-up on the table, readable from
// across it. green = good pace, amber = a bit fast or two people at once, red = too fast.
// One big word, the wpm small, the mascot small on top. Tapping anywhere reveals the controls.
import type { PaceLevel } from '../../../shared/types';
import { PresenceAuto } from '../ui/PresenceAuto';
import { IconOverlap, IconPace } from '../ui/icons';

export interface LampPace { wpm: number; level: PaceLevel; overlap: boolean }
type Tone = 'good' | 'amber' | 'red' | 'idle';

const TONE: Record<Tone, { bg: string; fg: string; sub: string }> = {
  good: { bg: '#3fcf8e', fg: '#06170e', sub: 'rgb(6 23 14 / .78)' },
  amber: { bg: '#f6b93b', fg: '#1d1303', sub: 'rgb(29 19 3 / .78)' },
  red: { bg: '#ff5d4d', fg: '#1e0503', sub: 'rgb(30 5 3 / .8)' },
  idle: { bg: '#25221e', fg: '#f5f1e8', sub: '#b8b0a2' },
};

export function lampState(pace: LampPace | null, muted: boolean, host: string): { tone: Tone; word: string; line: string } {
  if (muted) return { tone: 'idle', word: 'Muted', line: 'The table can’t hear you' };
  if (!pace) return { tone: 'idle', word: 'Ready', line: `Talk normally, ${host} is following` };
  if (pace.level === 'too_fast') return { tone: 'red', word: 'Too fast', line: `Too fast for ${host} to follow` };
  if (pace.overlap) return { tone: 'amber', word: 'One at a time', line: `One at a time helps ${host}` };
  if (pace.level === 'fast') return { tone: 'amber', word: 'Slower', line: `A bit fast for ${host}` };
  return { tone: 'good', word: 'Good', line: pace.wpm ? `Good pace for ${host}` : `Talk normally, ${host} is following` };
}

export function Lamp({ pace, muted, host, name, heard, level, onReveal }: {
  pace: LampPace | null; muted: boolean; host: string; name: string; heard: boolean; level: number; onReveal: () => void;
}) {
  const st = lampState(pace, muted, host);
  const t = TONE[st.tone];
  return (
    <button type="button" onClick={onReveal} data-testid="lamp" data-tone={st.tone}
      aria-label={`Lamp: ${st.word}. ${st.line}.${pace?.wpm ? ` ${pace.wpm} words per minute.` : ''} Tap to show controls.`}
      className="fixed inset-0 z-30 flex cursor-pointer flex-col items-center justify-between px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center transition-colors duration-500"
      style={{ background: t.bg, color: t.fg }}>
      <span className="flex flex-col items-center gap-2">
        <span className="flex size-[84px] items-center justify-center rounded-full bg-[#12110f]/85 shadow-[0_10px_30px_-10px_rgb(0_0_0/.5)]">
          <PresenceAuto size={72} halo={false} state={muted ? 'idle' : heard ? 'speaking' : 'listening'} level={level} />
        </span>
        <span className="font-mono text-[0.78rem] font-semibold tracking-[0.16em] uppercase" style={{ color: t.sub }}>{name}</span>
      </span>

      <span className="flex flex-col items-center">
        {pace?.overlap && !muted && <IconOverlap size={56} strokeWidth={2} className="mb-3" />}
        <span className="font-display-italic text-[4.6rem] leading-[0.95] sm:text-[6rem]" role="status" aria-live="polite">{st.word}</span>
        <span className="mt-4 max-w-xs text-[1.3rem] leading-snug font-semibold">{st.line}</span>
      </span>

      <span className="flex flex-col items-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[1rem] font-semibold tabular-nums" style={{ color: t.sub }}>
          <IconPace size={18} strokeWidth={2} />{pace?.wpm ? `${pace.wpm} wpm` : '– wpm'}
        </span>
        <span className="font-mono text-[0.7rem] tracking-[0.14em] uppercase" style={{ color: t.sub }}>Tap for controls</span>
      </span>
    </button>
  );
}
