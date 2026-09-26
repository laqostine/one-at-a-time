// The "table ring": a tiny seating diagram. You sit at the bottom; everyone else is a colored
// seat around the ring (joined phones, or diarized voices when nobody joined). The person
// talking right now is lit. Color is never alone: the active name is written underneath.
import { cn } from '@/lib/utils';

export interface Seat { id: number; name: string; color: string; active: boolean }

interface Props {
  seats: Seat[];
  source: 'phones' | 'voices';
  size?: number;
  className?: string;
}

const MAX = 8;

export function TableRing({ seats, source, size = 96, className }: Props) {
  const shown = seats.slice(0, MAX);
  const n = shown.length + 1; // + you
  const R = 36;
  const pos = (i: number) => {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / n; // i=0 (you) at the bottom
    return { x: 50 + R * Math.cos(a), y: 50 + R * Math.sin(a) };
  };
  const active = shown.find((s) => s.active);
  const label = `The table: ${shown.length ? shown.map((s) => `${s.name}${s.active ? ' (speaking)' : ''}`).join(', ') + ', and you' : 'just you so far'}. ${source === 'phones' ? 'From joined phones.' : 'From voices heard.'}`;
  const you = pos(0);

  return (
    <figure className={cn('flex shrink-0 flex-col items-center gap-1', className)} style={{ minWidth: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label} className="overflow-visible">
        {/* the table */}
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--line-strong)" strokeWidth="1.5" strokeDasharray="2 3.2" />
        <circle cx="50" cy="50" r={R - 13} fill="color-mix(in oklab, var(--card-2) 70%, transparent)" stroke="var(--line)" strokeWidth="1" />
        <text x="50" y="49" textAnchor="middle" className="fill-fg font-mono" style={{ fontSize: 17, fontWeight: 600 }}>{shown.length + 1}</text>
        <text x="50" y="60" textAnchor="middle" className="fill-muted font-mono" style={{ fontSize: 7.2, letterSpacing: '.12em' }}>{source === 'phones' ? 'PHONES' : 'VOICES'}</text>
        {/* you */}
        <circle cx={you.x} cy={you.y} r="6" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />
        <text x={you.x} y={you.y + 16} textAnchor="middle" className="fill-accent font-mono" style={{ fontSize: 7.5, letterSpacing: '.1em' }}>YOU</text>
        {shown.map((s, k) => {
          const p = pos(k + 1);
          return (
            <g key={s.id}>
              <title>{s.name}{s.active ? ' (speaking)' : ''}</title>
              {s.active && <circle cx={p.x} cy={p.y} r="12.5" fill={s.color} opacity=".28" className="imt-pulse" style={{ transformOrigin: `${p.x}px ${p.y}px` }} />}
              <circle cx={p.x} cy={p.y} r={s.active ? 7.5 : 5.5} fill={s.color} stroke="var(--bg)" strokeWidth="1.5"
                opacity={active && !s.active ? 0.55 : 1} style={{ transition: 'r 200ms, opacity 200ms' }} />
            </g>
          );
        })}
      </svg>
      <figcaption aria-hidden className="h-4 max-w-[10rem] truncate font-mono text-[0.66rem] tracking-wide text-muted">
        {active ? <><span style={{ color: `color-mix(in oklab, ${active.color} 70%, white)` }}>{active.name}</span> talking</> : shown.length ? 'quiet' : 'no one yet'}
      </figcaption>
    </figure>
  );
}
