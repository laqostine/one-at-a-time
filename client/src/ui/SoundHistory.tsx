import { useEffect, useState } from 'react';
import type { AudioEvent } from '../../../shared/types';
import { eventMeta } from './EventChip';
import { IconSounds } from './icons';

/** Last few non-speech sounds with time-ago, so a sound leaves a trace. */
export function SoundHistory({ events, getNow }: { events: AudioEvent[]; getNow: () => number }) {
  const [nowT, setNowT] = useState(getNow);
  const has = events.length > 0;
  useEffect(() => {
    if (!has) return;
    setNowT(getNow());
    const id = window.setInterval(() => setNowT(getNow()), 5000);
    return () => window.clearInterval(id);
  }, [has, getNow, events]);
  const last = events.slice(-5).reverse();
  if (!last.length) return null;
  const ago = (t: number) => {
    const s = Math.max(0, Math.round((nowT - t) / 1000));
    return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
  };
  return (
    <div aria-label="Sound history" role="group" className="flex h-7 shrink-0 items-center gap-1.5 overflow-hidden px-1 whitespace-nowrap">
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
