// Say card: the host's line, full screen on every phone (text-first "Speak for me").
// "<name> wants to say:" small, the line large, a 10 s countdown ring. Tap anywhere to dismiss.
import { useEffect } from 'react';
import { IconSpeakForMe } from '../ui/icons';

export interface SayMsg { name: string; text: string; t: number }
export const SAY_MS = 10_000;

const R = 24;
const LEN = 2 * Math.PI * R;

export function SayCard({ say, onDismiss }: { say: SayMsg; onDismiss: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, SAY_MS);
    return () => window.clearTimeout(id);
  }, [say, onDismiss]);

  return (
    <button type="button" onClick={onDismiss} data-testid="say-card"
      aria-label={`${say.name} wants to say: ${say.text}. Tap to dismiss.`}
      className="fixed inset-0 z-40 flex cursor-pointer items-center justify-center bg-[#12110f]/92 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-left backdrop-blur-sm">
      <span className="imt-rise relative flex w-full max-w-md flex-col rounded-[1.75rem] border-2 border-accent bg-card p-6 shadow-[var(--glow-accent),0_40px_80px_-30px_rgb(0_0_0/.9)]">
        <span className="flex items-start gap-3">
          <span className="flex min-w-0 flex-1 items-center gap-2 font-mono text-[0.85rem] font-semibold tracking-[0.12em] text-accent uppercase">
            <IconSpeakForMe size={22} className="shrink-0" />
            <span className="truncate">{say.name} wants to say:</span>
          </span>
          {/* 10 s countdown ring */}
          <svg key={say.t} viewBox="0 0 56 56" width="48" height="48" aria-hidden className="-mt-2 -mr-2 shrink-0 -rotate-90">
            <circle cx="28" cy="28" r={R} fill="none" stroke="var(--line)" strokeWidth="4" />
            <circle cx="28" cy="28" r={R} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={LEN} className="imt-countdown" style={{ ['--ring-len' as string]: `${LEN}`, ['--ring-ms' as string]: `${SAY_MS}ms` }} />
          </svg>
        </span>
        <span className="mt-5 text-[2.2rem] leading-[1.15] font-semibold text-fg">{say.text}</span>
        <span className="mt-6 font-mono text-[0.72rem] tracking-[0.14em] text-muted uppercase">Tap to dismiss</span>
      </span>
    </button>
  );
}
