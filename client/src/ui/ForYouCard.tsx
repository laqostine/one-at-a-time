import { IconForYou } from './icons';
import { ObjIcon } from './ObjIcon';
import type { LedgerItem } from '../../../shared/types';
import type { Nudge } from '../state/useSession';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LedgerRow } from './LedgerRow';

interface Props {
  items: LedgerItem[];
  nudge: Nudge | null;
  nudgeColor: string;
  colorFor: (name?: string) => string;
  onDismiss: () => void;
  onOpen: (t: number) => void;
  /** Phone card body: no header or card chrome (the tab strip names it); a single quiet sentence when empty. */
  bare?: boolean;
  className?: string;
}

/** Things aimed at the user. The live nudge is the app's only proactive interrupt (amber glow, not red). */
export function ForYouCard({ items, nudge, nudgeColor, colorFor, onDismiss, onOpen, bare = false, className }: Props) {
  // While the live question rings, the older list steps aside (the ring already says it).
  const mine = nudge ? [] : items.filter((i) => i.kind === 'assigned_to_me').slice(-2);
  return (
    <Card role="region" aria-label="Asked you" className={cn(bare ? 'gap-1 rounded-none border-0 bg-transparent p-0 shadow-none sm:p-0' : 'dish shrink-0 px-3 sm:px-4', !bare && nudge && 'shadow-[0_0_0_3px_var(--lamplight),var(--shadow-sheet)]', className)}>
      {!bare && <CardHeader className="px-1">
        <span key={nudge?.id ?? 'still'} className={cn('inline-flex', nudge && 'imt-ring')}><ObjIcon name="bell" fallback={IconForYou} size={52} className="-my-3" /></span>
        <CardTitle className="text-warn!">Asked you</CardTitle>
      </CardHeader>}
      <div aria-live="polite" aria-atomic="true">
        {nudge && (
          <div key={nudge.id} className={cn('imt-flash rounded-xl bg-lamplight text-ink', bare ? 'px-3.5 py-2.5' : 'mb-2 px-4 py-3')} data-testid="nudge">
            <p className="flex items-start gap-3 text-body-lg">
              <span className="min-w-0" title={nudge.question}>
                <span className="flex items-center gap-2 font-semibold">
                  <span aria-hidden className="size-3 shrink-0 rounded-full ring-2 ring-ink/25" style={{ background: nudgeColor }} />
                  <span>{nudge.speaker} asked <span className="underline decoration-[#3f5f86] decoration-2 underline-offset-4">you</span>:</span>
                </span>
                <q className={cn('mt-1 block font-display leading-[1.12] italic', bare ? 'line-clamp-2 text-[1.4rem]' : 'line-clamp-3 text-[1.5rem]')}>{nudge.question}</q>
              </span>
            </p>
            <div className={cn('grid grid-cols-3 gap-2', bare ? 'mt-2' : 'mt-3')}>
              {['Yes', 'Clarify', "Can't"].map((l) => (
                <Button key={l} type="button" variant="secondary" onClick={onDismiss} className="h-[3.2rem] border border-ink/20 bg-cream/70 text-[1.05rem] font-semibold text-ink hover:bg-cream">{l}</Button>
              ))}
            </div>
          </div>
        )}
      </div>
      {mine.length ? (
        <ul className="space-y-0.5">
          {mine.map((i) => <LedgerRow key={i.id} item={i} color={colorFor(i.speaker)} onOpen={() => onOpen(i.t)} compact plain={bare} />)}
        </ul>
      ) : !nudge && (
        <p className="px-1 pt-1 text-body text-muted">{bare ? 'Nothing asked of you yet.' : 'Nothing yet. A question for you rings here.'}</p>
      )}
    </Card>
  );
}
