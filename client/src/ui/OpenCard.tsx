import type { LedgerItem, Thread } from '../../../shared/types';
import { matchThread, normalizeLabel } from '../../../shared/threads';
import { Card, CardAction, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, readable } from '@/lib/utils';
import { LedgerRow } from './LedgerRow';
import { IconThread } from './icons';

interface Props {
  items: LedgerItem[];
  /** Conversation lanes from useSession().threads (optional: absent => grouped by item.thread label). */
  threads?: Thread[];
  colorFor: (name?: string) => string;
  onOpen: (t: number) => void;
}

const MAX_LANES = 3;
const GENERAL = 'general';

interface Lane { key: string; label: string; participants: string[]; items: LedgerItem[]; firstT: number; lastT: number }

/** Group ledger items into lanes: threadId (if the lane is known) > fuzzy label match > raw label > General. */
function buildLanes(items: LedgerItem[], threads: Thread[]): Lane[] {
  const byId = new Map(threads.map((t) => [t.id, t]));
  const lanes = new Map<string, Lane>();
  for (const i of items) {
    const tid = i.threadId && byId.has(i.threadId) ? i.threadId : matchThread(i.thread, threads);
    const th = tid ? byId.get(tid) : undefined;
    const key = th ? `id:${th.id}` : i.thread?.trim() ? `label:${normalizeLabel(i.thread ?? '')}` : GENERAL;
    let lane = lanes.get(key);
    if (!lane) {
      lane = { key, label: th?.label ?? i.thread?.trim() ?? 'General', participants: th?.participants ?? [], items: [], firstT: i.t, lastT: i.t };
      lanes.set(key, lane);
    }
    lane.items.push(i);
    lane.firstT = Math.min(lane.firstT, i.t);
    lane.lastT = Math.max(lane.lastT, i.t, th?.lastT ?? 0);
  }
  // Participants fallback: whoever spoke or was answered in this lane.
  for (const l of lanes.values()) {
    if (l.participants.length) continue;
    const names = new Set<string>();
    for (const i of l.items) { if (i.speaker) names.add(i.speaker); if (i.replyTo) names.add(i.replyTo); }
    l.participants = [...names];
  }
  // Keep the most recently active lanes, then show them in stable first-appearance order (no reshuffling).
  return [...lanes.values()].sort((a, b) => b.lastT - a.lastT).slice(0, MAX_LANES).sort((a, b) => a.firstT - b.firstT);
}

function pick(items: LedgerItem[], max: number): LedgerItem[] {
  const unresolved = items.filter((i) => !i.resolved);
  return (unresolved.length >= max ? unresolved : items).slice(-max);
}

/** Decisions / objections / open questions / changes, in parallel conversation lanes. Stable order; resolved items fade. */
export function OpenCard({ items, threads = [], colorFor, onOpen }: Props) {
  const open = items.filter((i) => i.kind !== 'assigned_to_me');
  const unresolved = open.filter((i) => !i.resolved);
  const lanes = buildLanes(open, threads);
  const lanesView = lanes.length > 1 || (lanes.length === 1 && lanes[0].key !== GENERAL);
  const perLane = lanes.length <= 1 ? 4 : lanes.length === 2 ? 3 : 2;
  const shownOpen = (lanesView ? lanes.flatMap((l) => pick(l.items, perLane)) : pick(open, 4)).filter((i) => !i.resolved).length;
  const hidden = Math.max(0, unresolved.length - shownOpen);

  return (
    <Card role="region" aria-label="Open on the table" className="min-h-0 flex-1 overflow-hidden px-3 sm:px-4">
      <CardHeader className="px-1">
        <CardTitle>Open on the table</CardTitle>
        <CardAction>
          {lanesView && lanes.length > 1 && <span className="font-mono text-[0.72rem] text-muted tabular-nums">{lanes.length} threads</span>}
          {unresolved.length > 0 && <Badge variant="secondary" className="font-mono tabular-nums">{unresolved.length} open</Badge>}
          {hidden > 0 && <span className="text-meta">+{hidden} more</span>}
        </CardAction>
      </CardHeader>
      {!open.length ? (
        <p className="px-1 text-body text-muted">Nothing open yet. Decisions, objections and questions show up here, grouped by conversation.</p>
      ) : !lanesView ? (
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-hidden">
          {pick(open, 4).map((i) => <LedgerRow key={i.id} item={i} color={colorFor(i.speaker)} replyColor={colorFor(i.replyTo)} onOpen={() => onOpen(i.t)} />)}
        </ul>
      ) : (
        <div className={cn('grid min-h-0 flex-1 content-start gap-2.5 overflow-hidden', lanes.length > 1 && 'md:grid-cols-2')}>
          {lanes.map((l) => (
            <LaneView key={l.key} lane={l} max={perLane} colorFor={colorFor} onOpen={onOpen} wide={lanes.length === 3} />
          ))}
        </div>
      )}
    </Card>
  );
}

function LaneView({ lane, max, colorFor, onOpen, wide }: { lane: Lane; max: number; colorFor: Props['colorFor']; onOpen: Props['onOpen']; wide: boolean }) {
  const list = pick(lane.items, max);
  const openN = lane.items.filter((i) => !i.resolved).length;
  const people = lane.participants.slice(0, 3);
  const more = lane.participants.length - people.length;
  return (
    <section aria-label={`Thread: ${lane.label}${lane.participants.length ? `, with ${lane.participants.join(', ')}` : ''}`}
      className={cn('surface-2 min-w-0 rounded-2xl py-2.5 pr-1.5 pl-2.5', wide && 'md:last:col-span-2')}>
      <header className="flex min-w-0 items-center gap-2 px-1 pb-1">
        <IconThread size={16} strokeWidth={2} className="shrink-0 text-accent" />
        <h3 className="min-w-0 truncate text-[0.92rem] font-semibold text-fg">{lane.label}</h3>
        {openN > 0 && <span className="shrink-0 font-mono text-[0.68rem] text-muted tabular-nums">{openN} open</span>}
        {people.length > 0 && (
          <ul className="ml-auto flex shrink-0 items-center -space-x-1.5" aria-label={`People in this thread: ${lane.participants.join(', ')}`}>
            {people.map((p) => {
              const c = colorFor(p);
              return (
                <li key={p} title={p} className="flex size-6 items-center justify-center rounded-full border-2 border-card-2 text-[0.68rem] font-bold"
                  style={{ background: `color-mix(in oklab, ${c} 32%, var(--card-2))`, color: readable(c) }}>
                  <span aria-hidden>{p.slice(0, 1).toUpperCase()}</span>
                </li>
              );
            })}
            {more > 0 && <li className="pl-2.5 font-mono text-[0.68rem] text-muted">+{more}</li>}
          </ul>
        )}
      </header>
      {/* lane rail: a faint vertical line ties the items of one conversation together */}
      <ul className="ml-[0.2rem] space-y-0.5 border-l border-line pl-1">
        {list.map((i) => <LedgerRow key={i.id} item={i} color={colorFor(i.speaker)} replyColor={colorFor(i.replyTo)} onOpen={() => onOpen(i.t)} />)}
      </ul>
    </section>
  );
}
