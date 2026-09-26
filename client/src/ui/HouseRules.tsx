// House rules: the table's contract, written like a card on the fridge. Shown on the host's
// placemat before anyone speaks, on the join page, and on the landing page. Same three lines everywhere.
import { IconMug, IconPhoneMic, IconRules, IconLamp } from './icons';
import type { ObjName } from './ObjIcon';
import { cn } from '@/lib/utils';
import { ObjIcon } from './ObjIcon';

export function houseRules(host: string) {
  return [
    { Icon: IconMug, obj: 'mug' as ObjName, title: 'One at a time', body: 'Whoever has the mug has the floor.' },
    { Icon: IconLamp, obj: 'lamp' as ObjName, title: `Face ${host}`, body: 'Faces in the light. Lips carry half the words.' },
    { Icon: IconPhoneMic, obj: 'phone' as ObjName, title: 'Phones on the table', body: 'Screen up. Your phone is your mic.' },
  ];
}

/** variant 'card' = linen card (join, landing); 'mat' = printed straight on the placemat (host, before anyone speaks). */
export function HouseRules({ host, variant = 'card', className }: { host: string; variant?: 'card' | 'mat'; className?: string }) {
  const rules = houseRules(host);
  return (
    <section aria-label="House rules" className={cn(variant === 'card' && 'linen rotate-[-0.6deg] rounded-2xl px-5 pt-4 pb-5', className)}>
      <h2 className="flex items-center gap-2 font-mono text-[0.72rem] font-semibold tracking-[0.16em] text-ink-muted uppercase">
        {variant === 'card' ? <ObjIcon name="card" fallback={IconRules} size={44} className="-my-2 -ml-1" /> : <IconRules size={16} strokeWidth={2} />}House rules
      </h2>
      <ol className="mt-2.5 space-y-2">
        {rules.map(({ Icon, obj, title, body }, k) => (
          <li key={title} className="flex items-start gap-3">
            <ObjIcon name={obj} fallback={Icon} size={variant === 'card' ? 48 : 40} className="-my-1" />
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
