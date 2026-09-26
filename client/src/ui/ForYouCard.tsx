import { BellRing } from 'lucide-react';
import type { LedgerItem } from '../../../shared/types';
import type { Nudge } from '../state/useSession';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { readable } from '@/lib/utils';
import { LedgerRow } from './LedgerRow';

interface Props {
  items: LedgerItem[];
  nudge: Nudge | null;
  nudgeColor: string;
  colorFor: (name?: string) => string;
  onDismiss: () => void;
  onOpen: (t: number) => void;
}

/** Things aimed at the user. The live nudge is the app's only proactive interrupt (amber glow, not red). */
export function ForYouCard({ items, nudge, nudgeColor, colorFor, onDismiss, onOpen }: Props) {
  const mine = items.filter((i) => i.kind === 'assigned_to_me').slice(-2);
  return (
    <Card role="region" aria-label="For you" className="shrink-0 px-3 sm:px-4">
      <CardHeader className="px-1">
        <CardTitle>For you</CardTitle>
      </CardHeader>
      <div aria-live="polite" aria-atomic="true">
        {nudge && (
          <div key={nudge.id} className="imt-flash mb-2 rounded-xl border border-warn/70 bg-warn/10 px-4 py-3" data-testid="nudge">
            <p className="flex items-start gap-3 text-body-lg">
              <BellRing size={24} className="mt-0.5 shrink-0 text-warn" aria-hidden />
              <span>
                <strong style={{ color: readable(nudgeColor) }}>{nudge.speaker}</strong> asked you:{' '}
                <q className="font-semibold">{nudge.question}</q>
              </span>
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {['Yes', 'Clarify', "Can't"].map((l) => (
                <Button key={l} type="button" variant="secondary" onClick={onDismiss} className="h-11 text-[1rem]">{l}</Button>
              ))}
            </div>
          </div>
        )}
      </div>
      {mine.length ? (
        <ul className="space-y-0.5">
          {mine.map((i) => <LedgerRow key={i.id} item={i} color={colorFor(i.speaker)} onOpen={() => onOpen(i.t)} />)}
        </ul>
      ) : !nudge && (
        <p className="px-1 text-body text-muted">Nothing asked of you.</p>
      )}
    </Card>
  );
}
