// The listener's line on every phone (DESIGN.md §2): the screen turns cream, label "BERA SAYS",
// the sentence in display italic 36. Tap anywhere to dismiss.
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
      className="oat-fade fixed inset-0 z-40 flex cursor-pointer flex-col justify-center bg-cream px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-left text-ink">
      <span className="oat-label">{/^they$/i.test(say.name.trim()) ? 'They say' : `${say.name} says`}</span>
      <span className="oat-in mt-4 block font-display-italic text-[36px] leading-[1.14]">{say.text}</span>
    </button>
  );
}
