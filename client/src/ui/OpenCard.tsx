import type { LedgerItem } from '../../../shared/types';
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
    <section aria-label="Open on the table" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-card px-2 py-3">
      <h2 className="px-2 pb-1 text-[0.75rem] font-semibold tracking-wider text-muted uppercase">
        Open on the table {unresolved.length > MAX && <span className="normal-case">· +{unresolved.length - MAX} more</span>}
      </h2>
      {shown.length ? (
        <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden">
          {[...groups].map(([thread, list]) => (
            <div key={thread}>
              {showHeaders && <h3 className="truncate px-2 text-[0.75rem] text-muted">{thread}</h3>}
              <ul className="space-y-0.5">
                {list.map((i) => <LedgerRow key={i.id} item={i} color={colorFor(i.speaker)} onOpen={() => onOpen(i.t)} />)}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-2 text-[1rem] text-muted">Nothing open yet. Decisions, objections and questions show up here.</p>
      )}
    </section>
  );
}
