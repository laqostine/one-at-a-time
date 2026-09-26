// House rules: the table's contract, written like a card on the fridge. Shown on the host's
// placemat before anyone speaks, on the join page, and on the landing page. Same three lines everywhere.
import { IconMug, IconPhoneMic, IconRules, IconForYou } from './icons';
import { cn } from '@/lib/utils';

export function houseRules(host: string) {
  return [
    { Icon: IconMug, title: 'One at a time', body: 'Whoever has the mug has the floor.' },
    { Icon: IconForYou, title: `Face ${host}`, body: 'Lips and faces carry half the words.' },
    { Icon: IconPhoneMic, title: 'Phones on the table', body: 'Screen up. Your phone is your mic.' },
  ];
}

/** variant 'card' = linen card (join, landing); 'mat' = printed straight on the placemat (host, before anyone speaks). */
export function HouseRules({ host, variant = 'card', className }: { host: string; variant?: 'card' | 'mat'; className?: string }) {
  const rules = houseRules(host);
  return (
    <section aria-label="House rules" className={cn(variant === 'card' && 'linen rotate-[-0.6deg] rounded-2xl px-5 pt-4 pb-5', className)}>
      <h2 className="flex items-center gap-2 font-mono text-[0.72rem] font-semibold tracking-[0.16em] text-ink-muted uppercase">
        <IconRules size={16} strokeWidth={2} />House rules
      </h2>
      <ol className="mt-2.5 space-y-2">
        {rules.map(({ Icon, title, body }, k) => (
          <li key={title} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-ink/25 text-ink"><Icon size={18} /></span>
            <span className="min-w-0">
              <span className="block font-display text-[1.45rem] leading-tight text-ink"><span className="sr-only">{k + 1}. </span>{title}</span>
              <span className="block text-[0.95rem] leading-snug text-ink-muted">{body}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
