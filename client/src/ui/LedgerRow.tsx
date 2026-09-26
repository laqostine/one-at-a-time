import { IconChanged, IconDecision, IconForYou, IconObjection, IconQuestion, type IconType } from './icons';
import type { LedgerItem, LedgerKind } from '../../../shared/types';
import { cn, readable } from '@/lib/utils';
import { ReplyTo } from './ReplyTo';

/** Semantic kind styling. Every tint is >= 7:1 on the card background (AA with margin). */
export const KIND: Record<LedgerKind, { label: string; Icon: IconType; tint: string; badge: string }> = {
  decision: { label: 'Decision', Icon: IconDecision, tint: 'text-good', badge: 'border-good/35 bg-good/12 text-good' },
  objection: { label: 'Objection', Icon: IconObjection, tint: 'text-bad', badge: 'border-bad/35 bg-bad/12 text-bad' },
  open_question: { label: 'Question', Icon: IconQuestion, tint: 'text-accent', badge: 'border-accent/35 bg-accent/12 text-accent' },
  assigned_to_me: { label: 'For you', Icon: IconForYou, tint: 'text-warn', badge: 'border-warn/40 bg-warn/12 text-warn' },
  instruction_change: { label: 'Changed', Icon: IconChanged, tint: 'text-change', badge: 'border-change/35 bg-change/12 text-change' },
};

export function KindBadge({ kind, className }: { kind: LedgerKind; className?: string }) {
  const k = KIND[kind] ?? KIND.open_question;
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 font-mono text-[0.68rem] font-semibold tracking-wider uppercase', k.badge, className)}>
      <k.Icon size={14} strokeWidth={2.1} />{k.label}
    </span>
  );
}

export function LedgerRow({ item, color, replyColor, onOpen }: { item: LedgerItem; color: string; replyColor?: string; onOpen: () => void }) {
  const k = KIND[item.kind] ?? KIND.open_question;
  const showWhy = !!item.reason && (item.kind === 'decision' || item.kind === 'instruction_change');
  return (
    // key={item.id} upstream: a new row mounts with a brief tint; edits replace text in place.
    <li className={cn('imt-highlight rounded-xl transition-opacity duration-200', item.resolved && 'opacity-45')}>
      <button type="button" onClick={onOpen}
        className="group flex w-full cursor-pointer items-stretch gap-3 rounded-xl py-1.5 pr-2 pl-1 text-left transition-colors duration-150 hover:bg-white/[0.045]"
        aria-label={`${k.label}${item.speaker ? ` from ${item.speaker}` : ''}${item.replyTo ? ` to ${item.replyTo}` : ''}: ${item.text}${showWhy ? `. Why: ${item.reason}` : ''}${item.resolved ? ' (resolved)' : ''}. Show what was said.`}>
        <span aria-hidden className="w-1 shrink-0 rounded-full" style={{ background: item.speaker ? color : 'var(--line-strong)' }} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <KindBadge kind={item.kind} />
            {item.speaker && (
              <span className="truncate text-[0.85rem] font-semibold" style={{ color: readable(color) }}>{item.speaker}</span>
            )}
            <ReplyTo name={item.replyTo} color={replyColor} />
            {item.resolved && <span className="font-mono text-[0.7rem] tracking-wide text-muted uppercase">resolved</span>}
          </span>
          <span className={cn('mt-1 line-clamp-2 text-body', item.resolved && 'line-through decoration-muted')}>{item.text}</span>
          {showWhy && <span className="mt-0.5 block truncate text-meta italic">why: {item.reason}</span>}
        </span>
      </button>
    </li>
  );
}
