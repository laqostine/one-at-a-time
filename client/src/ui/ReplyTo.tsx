// "to Alex": who a line/item answered. Rendered as text (never color alone) with a subtle
// hooked connector, like a reply in a thread. Returns nothing when there is no replyTo.
import { readable } from '@/lib/utils';

export function ReplyTo({ name, color }: { name?: string; color?: string }) {
  if (!name) return null;
  return (
    <span className="mr-1.5 inline-flex items-baseline gap-1 align-baseline text-[0.8em] whitespace-nowrap text-muted">
      <span aria-hidden className="relative -top-[0.15em] inline-block h-[0.55em] w-[0.8em] rounded-bl-[0.35em] border-b-[1.5px] border-l-[1.5px] border-line-strong" />
      <span>to</span>
      <span className="font-semibold" style={{ color: color ? readable(color) : 'var(--fg)' }}>{name}</span>
    </span>
  );
}
