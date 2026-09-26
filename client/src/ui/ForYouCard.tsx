import { BellRing } from 'lucide-react';
import type { LedgerItem } from '../../../shared/types';
import type { Nudge } from '../state/useSession';
import { LedgerRow } from './LedgerRow';

interface Props {
  items: LedgerItem[];
  nudge: Nudge | null;
  nudgeColor: string;
  colorFor: (name?: string) => string;
  onDismiss: () => void;
  onOpen: (t: number) => void;
}

/** Things aimed at the user. The live nudge is the app's only proactive interrupt. */
export function ForYouCard({ items, nudge, nudgeColor, colorFor, onDismiss, onOpen }: Props) {
  const mine = items.filter((i) => i.kind === 'assigned_to_me').slice(-2);
  return (
    <section aria-label="For you" className="shrink-0 rounded-2xl border border-line bg-card px-2 py-3">
      <h2 className="px-2 pb-1 text-[0.75rem] font-semibold tracking-wider text-muted uppercase">For you</h2>
      <div aria-live="polite" aria-atomic="true">
        {nudge && (
          <div key={nudge.id} className="imt-flash mx-1 mb-2 rounded-xl border-2 border-warn bg-warn/10 px-3 py-2.5">
            <p className="flex items-start gap-2 text-[1.15rem] leading-snug">
              <BellRing size={22} className="mt-0.5 shrink-0 text-warn" aria-hidden />
              <span>
                <strong style={{ color: nudgeColor }}>{nudge.speaker}</strong> asked you:{' '}
                <q className="font-semibold">{nudge.question}</q>
              </span>
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {['Yes', 'Clarify', "Can't"].map((l) => (
                <button key={l} type="button" onClick={onDismiss}
                  className="rounded-lg border border-line bg-card-2 py-2 text-[1rem] font-semibold hover:border-fg">{l}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      {mine.length ? (
        <ul className="space-y-1">
          {mine.map((i) => <LedgerRow key={i.id} item={i} color={colorFor(i.speaker)} onOpen={() => onOpen(i.t)} />)}
        </ul>
      ) : !nudge && (
        <p className="px-2 text-[1rem] text-muted">Nothing asked of you.</p>
      )}
    </section>
  );
}
