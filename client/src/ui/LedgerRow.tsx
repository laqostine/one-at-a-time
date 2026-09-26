import { CircleHelp, Gavel, Hand, RefreshCw, UserCheck } from 'lucide-react';
import type { LedgerItem, LedgerKind } from '../../../shared/types';

export const KIND: Record<LedgerKind, { label: string; Icon: typeof Gavel; tint: string }> = {
  decision: { label: 'Decision', Icon: Gavel, tint: 'text-good' },
  objection: { label: 'Objection', Icon: Hand, tint: 'text-bad' },
  open_question: { label: 'Open question', Icon: CircleHelp, tint: 'text-accent' },
  assigned_to_me: { label: 'For you', Icon: UserCheck, tint: 'text-warn' },
  instruction_change: { label: 'Changed', Icon: RefreshCw, tint: 'text-change' },
};

export function LedgerRow({ item, color, onOpen }: { item: LedgerItem; color: string; onOpen: () => void }) {
  const k = KIND[item.kind] ?? KIND.open_question;
  const showWhy = !!item.reason && (item.kind === 'decision' || item.kind === 'instruction_change');
  return (
    <li className={`transition-opacity duration-700 ${item.resolved ? 'opacity-40' : ''}`}>
      <button type="button" onClick={onOpen}
        className="flex w-full items-start gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-card-2"
        aria-label={`${k.label}${item.speaker ? ` from ${item.speaker}` : ''}${item.replyTo ? ` to ${item.replyTo}` : ''}: ${item.text}${showWhy ? `. Why: ${item.reason}` : ''}${item.resolved ? ' (resolved)' : ''}. Show what was said.`}>
        <k.Icon size={20} className={`mt-1 shrink-0 ${k.tint}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={`line-clamp-2 text-[1.1rem] leading-snug ${item.resolved ? 'line-through' : ''}`}>
            {item.kind === 'instruction_change' && <span className="mr-1.5 font-semibold text-change">Changed:</span>}
            {item.text}
          </span>
          {showWhy && <span className="block truncate text-[0.85rem] text-muted">why: {item.reason}</span>}
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.8rem]">
            {item.speaker && (
              <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color }}>
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: color }} />{item.speaker}
              </span>
            )}
            {item.replyTo && <span className="text-muted">to {item.replyTo}</span>}
            <span className="text-muted">· {k.label.toLowerCase()}</span>
          </span>
        </span>
      </button>
    </li>
  );
}
