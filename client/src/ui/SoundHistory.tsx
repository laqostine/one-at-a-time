import { useEffect, useState } from 'react';
import type { AudioEvent } from '../../../shared/types';
import { EVENT_META } from './EventChip';

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
    <div aria-label="Sound history" className="flex shrink-0 items-center gap-1.5 overflow-hidden px-1 text-[0.8rem] whitespace-nowrap text-muted">
      <span className="shrink-0 font-semibold tracking-wider uppercase">Sounds</span>
      {last.map((e) => {
        const m = EVENT_META[e.kind] ?? { icon: '•', label: e.kind };
        return (
          <span key={e.id} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-card-2 px-2 py-0.5 tabular-nums">
            <span aria-hidden>{m.icon}</span>{m.label} · {ago(e.t)}
          </span>
        );
      })}
    </div>
  );
}
