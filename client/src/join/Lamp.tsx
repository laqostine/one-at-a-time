// Lamp mode: the whole phone screen becomes a colored lamp, face-up on the table, readable from
// across it. green = good pace, amber = a bit fast or two people at once, red = too fast.
// One big word, the wpm small, the mascot small on top. Tapping anywhere reveals the controls.
import type { PaceLevel } from '../../../shared/types';
import { PresenceAuto } from '../ui/PresenceAuto';
import { IconOverlap, IconPace } from '../ui/icons';

export interface LampPace { wpm: number; level: PaceLevel; overlap: boolean }
type Tone = 'good' | 'amber' | 'red' | 'idle';

// The brand's three lamp colors (design/BRAND.md) and an idle lamp that is just warm and dim.
const LAMP: Record<Tone, string> = { good: '#5D8A5E', amber: '#D99A3D', red: '#B8503A', idle: '#8a6a44' };

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
  const c = LAMP[st.tone];
  // The phone lies face-up on the walnut: a linen place card with its owner's name, a round brass
  // lamp lit in the table's color, and the house rules written on a paper slip at the bottom.
  return (
    <button type="button" onClick={onReveal} data-testid="lamp" data-tone={st.tone}
      aria-label={`Lamp: ${st.word}. ${st.line}.${pace?.wpm ? ` ${pace.wpm} words per minute.` : ''} Tap to show controls.`}
      className="fixed inset-0 z-30 flex cursor-pointer flex-col items-center justify-between overflow-hidden bg-dusk px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-center"
      style={{ backgroundImage: 'linear-gradient(180deg, rgb(27 20 16 / .3), rgb(27 20 16 / .72)), url("/tex/walnut-top.jpg")', backgroundSize: 'cover', backgroundPosition: '38% top' }}>
      {/* the lamp's light on the wood */}
      <span aria-hidden className="pointer-events-none absolute inset-0 transition-[background] duration-500"
        style={{ background: `radial-gradient(70% 42% at 50% 46%, color-mix(in oklab, ${c} 45%, transparent), transparent 72%)` }} />

      {/* place card */}
      <span className="linen relative flex w-full -rotate-1 items-center justify-between gap-3 rounded-[6px_10px_8px_12px] px-4 py-3 text-left">
        <span className="min-w-0">
          <span className="block font-mono text-[0.72rem] font-semibold tracking-[0.16em] text-ink-muted uppercase">Your phone is your mic</span>
          <span className="mt-0.5 block truncate font-display text-[3rem] leading-[1.02] text-ink italic">{name}</span>
        </span>
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#2a1d14] shadow-[inset_1px_2px_4px_rgb(0_0_0/.5)]">
          <PresenceAuto size={52} halo={false} state={muted ? 'idle' : heard ? 'speaking' : 'listening'} level={level} />
        </span>
      </span>

      {/* the lamp: a brass ring around a lit glass disc */}
      <span className="relative flex flex-col items-center">
        <span aria-hidden className="brass flex size-[min(64vw,16rem)] items-center justify-center rounded-full p-[7%]">
          <span className="flex size-full items-center justify-center rounded-full text-cream transition-colors duration-500"
            style={{ background: `radial-gradient(circle at 36% 30%, color-mix(in oklab, ${c} 45%, #F7F1E6), ${c} 58%, color-mix(in oklab, ${c} 70%, #1B1410))`, boxShadow: 'inset 3px 5px 10px rgb(27 20 16 / .45)' }}>
            {pace?.overlap && !muted && <IconOverlap size={64} strokeWidth={2} />}
          </span>
        </span>
        <span className="mt-6 font-display text-[3.4rem] leading-[0.95] text-cream italic [text-shadow:2px_3px_6px_rgb(27_20_16/.7)] sm:text-[4.6rem]" role="status" aria-live="polite">{st.word}</span>
      </span>

      {/* the paper slip: what the lamp means, the pace, the house rules in one handwritten line */}
      <span className="paper relative flex w-full rotate-[0.6deg] flex-col items-center gap-1 rounded-[4px] px-4 py-3">
        <span className="text-[1.2rem] leading-snug font-semibold text-ink">{st.line}</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[0.9rem] font-semibold text-ink-muted tabular-nums">
          <IconPace size={16} strokeWidth={2} />{pace?.wpm ? `${pace.wpm} wpm` : '– wpm'}
        </span>
        <span className="mt-1 font-display text-[1.2rem] text-ink italic">One at a time · face {host} · screen up</span>
        <span className="font-mono text-[0.66rem] tracking-[0.14em] text-ink-muted uppercase">Tap for controls</span>
      </span>
    </button>
  );
}
