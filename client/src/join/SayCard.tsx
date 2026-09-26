// The listener's line, full screen on every phone: cream, their name, the sentence large. Tap to dismiss.
import { useEffect } from 'react';

export interface SayMsg { name: string; text: string; t: number }
export const SAY_MS = 10_000;

export function SayCard({ say, onDismiss }: { say: SayMsg; onDismiss: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, SAY_MS);
    return () => window.clearTimeout(id);
  }, [say, onDismiss]);

  return (
    <button type="button" onClick={onDismiss} data-testid="say-card"
      aria-label={`${say.name} says: ${say.text}. Tap to dismiss.`}
      className="oat-fade fixed inset-0 z-40 flex cursor-pointer flex-col bg-bg px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-left text-ink">
      <span className="font-display-italic text-[18px]">One at a time</span>
      <span className="my-auto block w-full">
        <span className="block text-[1.15rem] font-bold">{say.name} says</span>
        <span className="oat-in mt-3 block font-display-italic text-[2.35rem] leading-[1.12]">{say.text}</span>
      </span>
      <span className="font-mono text-[13px] text-muted">tap to close</span>
    </button>
  );
}
