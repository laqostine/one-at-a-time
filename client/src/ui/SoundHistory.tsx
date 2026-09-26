import { useEffect, useState } from 'react';
import type { AudioEvent } from '../../../shared/types';
import { eventMeta } from './EventChip';
import { IconSounds } from './icons';
import { cn } from '@/lib/utils';

interface Props {
  events: AudioEvent[];
  getNow: () => number;
  /** 'strip' = one row of chips (phone), 'cell' = bento cell with a list and an empty state (desktop). */
  variant?: 'strip' | 'cell';
  className?: string;
}

/** Last few non-speech sounds with time-ago, so a sound leaves a trace. */
export function SoundHistory({ events, getNow, variant = 'strip', className }: Props) {
  const [nowT, setNowT] = useState(getNow);
  const has = events.length > 0;
  useEffect(() => {
    if (!has) return;
    setNowT(getNow());
    const id = window.setInterval(() => setNowT(getNow()), 5000);
    return () => window.clearInterval(id);
  }, [has, getNow, events]);
  const ago = (t: number) => {
    const s = Math.max(0, Math.round((nowT - t) / 1000));
    return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
  };

  if (variant === 'cell') {
    const last = events.slice(-4).reverse();
    return (
      <section aria-label="Sound history" className={cn('surface-1 flex min-h-0 flex-col overflow-hidden rounded-3xl p-5', className)}>
        <h2 className="flex items-center gap-1.5 card-label"><IconSounds size={15} strokeWidth={2} />Sounds</h2>
        {last.length ? (
          <ul className="mt-3 min-h-0 space-y-1.5 overflow-hidden">
            {last.map((e, k) => {
              const m = eventMeta(e.kind);
              return (
                <li key={e.id} className={cn('imt-in flex items-center gap-2.5 text-[0.95rem]', k > 0 && 'text-muted')}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-change/30 bg-change/10 text-change">
                    <m.icon size={16} strokeWidth={2.2} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium capitalize">{m.label}</span>
                  <span className="shrink-0 font-mono text-[0.75rem] text-muted tabular-nums">{ago(e.t)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-[0.95rem] leading-snug text-muted">Laughs, knocks and alarms land here, so a sound leaves a trace.</p>
        )}
      </section>
    );
  }

  const last = events.slice(-5).reverse();
  if (!last.length) return null;
  return (
    <div aria-label="Sound history" role="group" className={cn('flex h-7 shrink-0 items-center gap-1.5 overflow-hidden px-1 whitespace-nowrap', className)}>
      <span className="flex shrink-0 items-center gap-1 card-label"><IconSounds size={15} strokeWidth={2} />Sounds</span>
      {last.map((e) => {
        const m = eventMeta(e.kind);
        return (
          <span key={e.id} className="imt-in inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card-2 px-2.5 text-[0.78rem] text-muted tabular-nums">
            <m.icon size={13} className="text-change" aria-hidden />{m.label} · {ago(e.t)}
          </span>
        );
      })}
    </div>
  );
}
