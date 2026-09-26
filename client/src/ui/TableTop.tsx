// The table, seen from above (desktop host). A walnut oval under a lamp; the joined phones are
// seats around the rim (empty chairs faint), the mascot sits at the head, and the linen placemat
// in the middle carries the sentence being said now. The Mug token sits in front of whoever has
// the floor and slides to the next speaker. A halo under the table glows in the lamp color the
// phones show (green calm, amber overlap, red too fast).
// Layout ideas ported from v0 chats sVRM3anYDGB (oval walnut + placards + mat) and jCvWSDPnc6e (seat ring).
import type { ReactNode } from 'react';
import type { Seat } from './TableRing';
import type { TableLampState } from './tableLamp';
import { IconChair, IconMug } from './icons';
import { ObjIcon } from './ObjIcon';
import { cn, readable } from '@/lib/utils';

interface Props {
  seats: Seat[];
  me: string;
  lamp: TableLampState;
  /** The mascot, sitting at the head of the table. */
  head: ReactNode;
  /** The placemat (NowCard variant="placemat"). */
  placemat: ReactNode;
  className?: string;
}

const MAX = 8;
const RX = 47; // seat ellipse radius, % of width
const RY = 45;

/** Seat slots around the rim: slot 0 = you (bottom), slot n/2 = the head (mascot), others clockwise. */
function layout(n: number) {
  const total = Math.max(6, n + 2 + ((n + 2) % 2));
  const head = total / 2;
  const angle = (i: number) => Math.PI / 2 + (i * 2 * Math.PI) / total;
  const slots = Array.from({ length: total }, (_, i) => i).filter((i) => i !== 0 && i !== head);
  return { total, angle, slots };
}
const at = (a: number, rx = RX, ry = RY) => ({ left: `${50 + rx * Math.cos(a)}%`, top: `${50 + ry * Math.sin(a)}%` });

export function TableTop({ seats, me, lamp, head, placemat, className }: Props) {
  const shown = seats.slice(0, MAX);
  const { angle, slots } = layout(shown.length);
  const activeIdx = shown.findIndex((s) => s.active);
  const active = activeIdx >= 0 ? shown[activeIdx] : null;
  const mugA = activeIdx >= 0 ? angle(slots[activeIdx]) : null;

  return (
    <section aria-label={`The table: ${shown.length ? shown.map((s) => s.name).join(', ') + ', and you' : 'just you so far'}. ${lamp.word}.`}
      className={cn('relative flex min-h-0 items-center justify-center [container-type:size]', className)}>
      {/* the table keeps its oval (5:4) at any size: as wide as fits, never wider than 1.25x the height */}
      <div className="relative aspect-[5/4] [container-type:inline-size]" style={{ width: 'min(100cqw, 125cqh)' }}>
      {/* lamp halo: the table's light, mirrored from the phones */}
      <div aria-hidden className="imt-lamp pointer-events-none absolute inset-[4%_2%] rounded-[50%] blur-3xl transition-[background] duration-700"
        style={{ background: `radial-gradient(closest-side, color-mix(in oklab, ${lamp.hex} 38%, transparent), transparent)` }} />
      {/* the walnut top */}
      <div aria-hidden className="wood absolute inset-[9%_6%] rounded-[50%]">
        <div className="absolute inset-[3.5%] rounded-[50%] border border-[#e8aa67]/25" />
      </div>

      {/* the placemat */}
      <div className="absolute top-1/2 left-1/2 z-[2] flex w-[60%] -translate-x-1/2 -translate-y-[46%] rotate-[-0.6deg] flex-col">
        {placemat}
      </div>

      {/* the head of the table: the mascot */}
      <div className="absolute z-[3] -translate-x-1/2 -translate-y-1/2" style={{ left: '50%', top: '7%' }}>{head}</div>

      {/* seats */}
      {slots.map((slot, k) => {
        const s = shown[k];
        const pos = at(angle(slot));
        if (!s) {
          return (
            <div key={`empty-${slot}`} aria-hidden title="An empty chair" className="absolute z-[3] -translate-x-1/2 -translate-y-1/2 text-muted/35" style={pos}>
              <IconChair size={28} />
            </div>
          );
        }
        return (
          <div key={s.id} className="absolute z-[3] -translate-x-1/2 -translate-y-1/2" style={pos}>
            <div className={cn('flex max-w-[11rem] items-center gap-2 rounded-2xl border px-3.5 py-2 text-[1.05rem] font-semibold shadow-[0_10px_20px_-8px_rgb(0_0_0/.7)] transition-[box-shadow,background-color,border-color,opacity] duration-300',
              s.active ? 'bg-[#45291f] text-fg' : 'border-white/12 bg-[#231915]/92 text-muted', active && !s.active && 'opacity-80')}
              style={s.active ? { borderColor: s.color, boxShadow: `0 0 0 4px color-mix(in oklab, ${s.color} 20%, transparent), 0 0 28px color-mix(in oklab, ${s.color} 55%, transparent)` } : undefined}>
              <span aria-hidden className={cn('size-3 shrink-0 rounded-full', s.active && 'imt-pulse')} style={{ background: s.color, boxShadow: s.active ? `0 0 10px ${s.color}` : undefined }} />
              <span className="truncate" style={s.active ? { color: readable(s.color) } : undefined}>{s.name}</span>
              {s.active && <span className="sr-only"> is talking and has the mug</span>}
            </div>
          </div>
        );
      })}

      {/* you */}
      <div className="absolute z-[3] -translate-x-1/2 -translate-y-1/2" style={at(angle(0))}>
        <div className="flex items-center gap-2 rounded-2xl border border-accent/55 bg-[#1b1916]/95 px-3.5 py-2 text-[1.05rem] font-semibold text-accent shadow-[var(--glow-accent)]">
          <span aria-hidden className="size-3 rounded-full border-2 border-accent" />{me || 'You'}<span className="font-mono text-[0.66rem] tracking-[0.14em] text-muted uppercase">you</span>
        </div>
      </div>

      {/* the mug: in front of whoever has the floor. The blend sits on the positioned wrapper so the
          render's black background drops out against the wood (a transformed child would isolate it). */}
      {mugA != null && (
        <>
          <div aria-hidden className="mug-token pointer-events-none absolute z-[4] -translate-x-1/2 -translate-y-1/2 mix-blend-screen" style={at(mugA, RX - 13, RY - 12)} title="The mug: whoever has it has the floor">
            <ObjIcon name="mug" fallback={IconMug} size={48} blend={false} />
          </div>
        </>
      )}
      </div>
    </section>
  );
}

/** The lamp pill: the table's light in words (color is never alone). */
export function LampPill({ lamp, className }: { lamp: TableLampState; className?: string }) {
  return (
    <div role="status" aria-label={`Table lamp: ${lamp.word}. ${lamp.hint}.`}
      className={cn('flex h-11 shrink-0 items-center gap-2.5 rounded-full border px-4 text-[0.95rem] font-semibold transition-colors duration-500', className)}
      style={{ borderColor: `color-mix(in oklab, ${lamp.hex} 50%, transparent)`, background: `color-mix(in oklab, ${lamp.hex} 12%, var(--card))` }}>
      <span aria-hidden className="size-3 rounded-full" style={{ background: lamp.hex, boxShadow: `0 0 12px ${lamp.hex}` }} />
      <span className="text-fg">{lamp.word}</span>
    </div>
  );
}

/** One quiet line under the table: what the objects mean. */
export function TableKey({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[0.68rem] tracking-wide text-muted', className)}>
      <span className="flex items-center gap-1.5"><IconMug size={15} strokeWidth={2} className="text-[#edbc8f]" />mug = has the floor</span>
      {children}
    </div>
  );
}
