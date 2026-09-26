import { CircleHelp, Gavel, Hand, RefreshCw, UserCheck } from 'lucide-react';
import type { LedgerItem, LedgerKind } from '../../../shared/types';
import { cn, readable } from '@/lib/utils';

/** Semantic kind styling. Every tint is >= 7:1 on the card background (AA with margin). */
export const KIND: Record<LedgerKind, { label: string; Icon: typeof Gavel; tint: string; badge: string }> = {
  decision: { label: 'Decision', Icon: Gavel, tint: 'text-good', badge: 'border-good/35 bg-good/12 text-good' },
  objection: { label: 'Objection', Icon: Hand, tint: 'text-bad', badge: 'border-bad/35 bg-bad/12 text-bad' },
  open_question: { label: 'Question', Icon: CircleHelp, tint: 'text-accent', badge: 'border-accent/35 bg-accent/12 text-accent' },
  assigned_to_me: { label: 'For you', Icon: UserCheck, tint: 'text-warn', badge: 'border-warn/40 bg-warn/12 text-warn' },
  instruction_change: { label: 'Changed', Icon: RefreshCw, tint: 'text-change', badge: 'border-change/35 bg-change/12 text-change' },
};

export function KindBadge({ kind, className }: { kind: LedgerKind; className?: string }) {
  const k = KIND[kind] ?? KIND.open_question;
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[0.72rem] font-semibold tracking-wide uppercase', k.badge, className)}>
      <k.Icon size={13} strokeWidth={2.5} aria-hidden />{k.label}
    </span>
  );
}

export function LedgerRow({ item, color, onOpen }: { item: LedgerItem; color: string; onOpen: () => void }) {
  const k = KIND[item.kind] ?? KIND.open_question;
  const showWhy = !!item.reason && (item.kind === 'decision' || item.kind === 'instruction_change');
  return (
    // key={item.id} upstream: a new row mounts with a brief tint; edits replace text in place.
    <li className={cn('imt-highlight rounded-xl transition-opacity duration-200', item.resolved && 'opacity-45')}>
      <button type="button" onClick={onOpen}
        className="group flex w-full cursor-pointer items-stretch gap-3 rounded-xl py-1.5 pr-2 pl-1 text-left transition-colors duration-150 hover:bg-card-2"
        aria-label={`${k.label}${item.speaker ? ` from ${item.speaker}` : ''}${item.replyTo ? ` to ${item.replyTo}` : ''}: ${item.text}${showWhy ? `. Why: ${item.reason}` : ''}${item.resolved ? ' (resolved)' : ''}. Show what was said.`}>
        <span aria-hidden className="w-1 shrink-0 rounded-full" style={{ background: item.speaker ? color : 'var(--line-strong)' }} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <KindBadge kind={item.kind} />
            {item.speaker && (
              <span className="truncate text-[0.85rem] font-semibold" style={{ color: readable(color) }}>{item.speaker}</span>
            )}
            {item.replyTo && <span className="text-meta">to {item.replyTo}</span>}
            {item.resolved && <span className="text-meta">resolved</span>}
          </span>
          <span className={cn('mt-1 line-clamp-2 text-body', item.resolved && 'line-through decoration-muted')}>{item.text}</span>
          {showWhy && <span className="mt-0.5 block truncate text-meta italic">why: {item.reason}</span>}
        </span>
      </button>
    </li>
  );
}
