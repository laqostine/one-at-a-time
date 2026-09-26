import { IconChanged, IconDecision, IconForYou, IconObjection, IconQuestion, type IconType } from './icons';
import type { LedgerItem, LedgerKind } from '../../../shared/types';
import { cn, readable } from '@/lib/utils';
import { ReplyTo } from './ReplyTo';

/** Semantic kind styling. Family-table labels (kinds in code are unchanged):
 * decision→Plan, objection→Pushback, open_question→Question, instruction_change→Changed, assigned_to_me→Asked you.
 * Every tint is >= 7:1 on the card background (AA with margin). */
export const KIND: Record<LedgerKind, { label: string; Icon: IconType; tint: string; badge: string }> = {
  decision: { label: 'Plan', Icon: IconDecision, tint: 'text-good', badge: 'border-good/35 bg-good/12 text-good' },
  objection: { label: 'Pushback', Icon: IconObjection, tint: 'text-bad', badge: 'border-bad/35 bg-bad/12 text-bad' },
  open_question: { label: 'Question', Icon: IconQuestion, tint: 'text-accent', badge: 'border-accent/35 bg-accent/12 text-accent' },
  assigned_to_me: { label: 'Asked you', Icon: IconForYou, tint: 'text-warn', badge: 'border-warn/40 bg-warn/12 text-warn' },
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

export function LedgerRow({ item, color, replyColor, onOpen, compact = false }: { item: LedgerItem; color: string; replyColor?: string; onOpen: () => void; compact?: boolean }) {
  const k = KIND[item.kind] ?? KIND.open_question;
  const showWhy = !!item.reason && (item.kind === 'decision' || item.kind === 'instruction_change');
  const aria = `${k.label}${item.speaker ? ` from ${item.speaker}` : ''}${item.replyTo ? ` to ${item.replyTo}` : ''}: ${item.text}${showWhy ? `. Because: ${item.reason}` : ''}${item.resolved ? ' (resolved)' : ''}. Show what was said.`;
  // A settled plan is the content, not clutter: only settled questions/pushback fade and strike through.
  const faded = !!item.resolved && item.kind !== 'decision';
  if (compact) {
    // Calm row for the table's dishes: one tinted icon, the sentence, then a quiet "Plan · Mom · because ..." line.
    return (
      <li className={cn('imt-highlight rounded-xl transition-opacity duration-200', faded && 'opacity-45')}>
        <button type="button" onClick={onOpen} aria-label={aria}
          className="flex w-full cursor-pointer items-start gap-3 rounded-xl px-1.5 py-2 text-left transition-colors duration-150 hover:bg-white/[0.045]">
          <k.Icon size={22} strokeWidth={2} className={cn('mt-0.5 shrink-0', k.tint)} />
          <span className="min-w-0 flex-1">
            <span className={cn('line-clamp-2 text-body', faded && 'line-clamp-1 line-through decoration-muted')}>{item.text}</span>
            <span className="mt-0.5 block truncate text-meta">
              {/* the dish is already called Plans: only the other kinds say what they are */}
              {item.kind !== 'decision' && <span className={k.tint}>{k.label} · </span>}
              {item.speaker && <span style={{ color: readable(color) }}>{item.speaker}</span>}
              {item.replyTo && <> to <span style={{ color: readable(replyColor ?? '') }}>{item.replyTo}</span></>}
              {showWhy && <span className="italic"> · because {item.reason}</span>}
            </span>
          </span>
        </button>
      </li>
    );
  }
  return (
    // key={item.id} upstream: a new row mounts with a brief tint; edits replace text in place.
    <li className={cn('imt-highlight rounded-xl transition-opacity duration-200', item.resolved && 'opacity-45')}>
      <button type="button" onClick={onOpen}
        className="group flex w-full cursor-pointer items-stretch gap-3 rounded-xl py-1.5 pr-2 pl-1 text-left transition-colors duration-150 hover:bg-white/[0.045]"
        aria-label={aria}>
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
          {showWhy && <span className="mt-0.5 block truncate text-meta italic">because {item.reason}</span>}
        </span>
      </button>
    </li>
  );
}
