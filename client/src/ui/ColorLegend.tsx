// "What the mascot's colors mean": 6 small dots with words. The current state is ringed.
import type { PresenceState } from './Presence';
import { PRESENCE_LEGEND } from './presenceStates';
import { cn } from '@/lib/utils';

export function ColorLegend({ current, flaring = false, detailed = false, className, id }: {
  current?: PresenceState; flaring?: boolean; detailed?: boolean; className?: string; id?: string;
}) {
  if (detailed) {
    return (
      <ul id={id} className={cn('space-y-2', className)}>
        {PRESENCE_LEGEND.map((m) => (
          <li key={m.key} className="flex items-start gap-3">
            <span aria-hidden className="mt-1 size-3.5 shrink-0 rounded-full" style={{ background: m.hex, boxShadow: `0 0 10px ${m.hex}66` }} />
            <span><span className="font-semibold capitalize">{m.word}</span> <span className="text-muted">{m.meaning}</span></span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul id={id} aria-label="What the mascot's colors mean" className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      {PRESENCE_LEGEND.map((m) => {
        const on = m.key === 'flare' ? flaring : m.key === current;
        return (
          <li key={m.key} title={m.meaning} aria-current={on ? 'true' : undefined}
            className={cn('flex items-center gap-1.5 font-mono text-[0.68rem] tracking-wide whitespace-nowrap transition-colors duration-200', on ? 'text-fg' : 'text-muted')}>
            <span aria-hidden className="relative flex size-3 items-center justify-center">
              {on && <span className="absolute inset-[-3px] rounded-full border" style={{ borderColor: m.hex }} />}
              <span className="size-2 rounded-full" style={{ background: m.hex }} />
            </span>
            {m.word}
          </li>
        );
      })}
    </ul>
  );
}
