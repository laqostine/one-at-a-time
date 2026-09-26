import type { LedgerItem } from '../../../shared/types';
import { Card, CardAction, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LedgerRow } from './LedgerRow';

interface Props {
  items: LedgerItem[];
  colorFor: (name?: string) => string;
  onOpen: (t: number) => void;
}

const MAX = 4;
const GENERAL = 'General';

/** Decisions / objections / open questions / changes, grouped by thread. Stable order; resolved items fade. */
export function OpenCard({ items, colorFor, onOpen }: Props) {
  const open = items.filter((i) => i.kind !== 'assigned_to_me');
  const unresolved = open.filter((i) => !i.resolved);
  const shown = (unresolved.length >= MAX ? unresolved : open).slice(-MAX);
  // Group by thread, keeping first-appearance order of threads (stable, no reflow).
  const groups = new Map<string, LedgerItem[]>();
  for (const i of shown) {
    const key = i.thread?.trim() || GENERAL;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }
  const showHeaders = groups.size > 1 || !groups.has(GENERAL);
  return (
    <Card role="region" aria-label="Open on the table" className="min-h-0 flex-1 overflow-hidden px-3 sm:px-4">
      <CardHeader className="px-1">
        <CardTitle>Open on the table</CardTitle>
        <CardAction>
          {unresolved.length > 0 && <Badge variant="secondary" className="tabular-nums">{unresolved.length} open</Badge>}
          {unresolved.length > MAX && <span className="text-meta">+{unresolved.length - MAX} more</span>}
        </CardAction>
      </CardHeader>
      {shown.length ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
          {[...groups].map(([thread, list]) => (
            <div key={thread}>
              {showHeaders && (
                <h3 className="flex items-center gap-2 px-1 pb-0.5 text-[0.78rem] font-semibold text-muted">
                  <span aria-hidden className="h-px w-3 bg-line-strong" />
                  <span className="truncate">{thread}</span>
                  <span aria-hidden className="h-px flex-1 bg-line" />
                </h3>
              )}
              <ul className="space-y-0.5">
                {list.map((i) => <LedgerRow key={i.id} item={i} color={colorFor(i.speaker)} onOpen={() => onOpen(i.t)} />)}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-1 text-body text-muted">Nothing open yet. Decisions, objections and questions show up here.</p>
      )}
    </Card>
  );
}
