// The table, seen from above (desktop host). A walnut oval under a lamp; the joined phones are
// seats around the rim (empty chairs faint), the mascot sits at the head, and the linen placemat
// in the middle carries the sentence being said now. The Mug token sits in front of whoever has
// the floor and slides to the next speaker. A halo under the table glows in the lamp color the
// phones show (green calm, amber overlap, red too fast).
// Layout ideas ported from v0 chats sVRM3anYDGB (oval walnut + placards + mat) and jCvWSDPnc6e (seat ring).
import type { ReactNode } from 'react';
import type { Seat } from './TableRing';
import type { TableLampState } from './tableLamp';
import { IconChair, IconLamp, IconMug, IconPhoneMic, IconPlate } from './icons';
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
      <div aria-hidden className="pointer-events-none absolute inset-[2%_0%] rounded-[50%] transition-[background] duration-700"
        style={{ background: `radial-gradient(closest-side, color-mix(in oklab, ${lamp.hex} 22%, transparent) 60%, transparent)` }} />
      {/* the walnut top */}
      <div aria-hidden className="wood absolute inset-[9%_6%] rounded-[50%]">
        <div className="absolute inset-[3.5%] rounded-[50%] border border-cream/10" />
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
            <div key={`empty-${slot}`} aria-hidden title="An empty chair" className="absolute z-[3] -translate-x-1/2 -translate-y-1/2 opacity-55" style={pos}>
              <ObjIcon name="chair" fallback={IconChair} size={52} />
            </div>
          );
        }
        return (
          <div key={s.id} className="absolute z-[3] -translate-x-1/2 -translate-y-1/2" style={pos}>
            <div className={cn('flex max-w-[14rem] items-center gap-2 whitespace-nowrap rounded-2xl border px-3.5 py-2 text-[1.05rem] font-semibold shadow-[var(--shadow-obj)] transition-[box-shadow,background-color,border-color,opacity] duration-300',
              s.active ? 'bg-[#3a2819] text-fg' : 'border-cream/12 bg-[#2a1d14]/92 text-muted', active && !s.active && 'opacity-80')}
              style={s.active ? { borderColor: s.color, boxShadow: `0 0 0 3px color-mix(in oklab, ${s.color} 30%, transparent), var(--shadow-obj)` } : undefined}>
              <span className="relative -my-2 -ml-2 shrink-0">
                <ObjIcon name="phone" fallback={IconPhoneMic} size={40} />
                <span aria-hidden className={cn('absolute right-0.5 bottom-1 size-3 rounded-full ring-2 ring-[#2a1d14]', s.active && 'imt-pulse')} style={{ background: s.color }} />
              </span>
              <span className="truncate" style={s.active ? { color: readable(s.color) } : undefined}>{s.name}</span>
              {s.active && <span className="sr-only"> is talking and has the mug</span>}
            </div>
          </div>
        );
      })}

      {/* you */}
      <div className="absolute z-[3] -translate-x-1/2 -translate-y-1/2" style={at(angle(0))}>
        <div className="flex items-center gap-2 rounded-2xl border-2 border-you bg-[#2a1d14]/95 px-3.5 py-2 text-[1.05rem] font-semibold text-fg shadow-[var(--shadow-obj)]">
          <ObjIcon name="plate" fallback={IconPlate} size={40} className="-my-2 -ml-2" />{me || 'You'}<span className="font-mono text-[0.66rem] tracking-[0.14em] text-muted uppercase">you</span>
        </div>
      </div>

      {/* the mug: in front of whoever has the floor. The blend sits on the positioned wrapper so the
          render's black background drops out against the wood (a transformed child would isolate it). */}
      {mugA != null && (
        <>
          <div aria-hidden className="mug-token pointer-events-none absolute z-[4] -translate-x-1/2 -translate-y-1/2" style={at(mugA, RX - 14, RY - 13)} title="The mug: whoever has it has the floor">
            <ObjIcon name="mug" fallback={IconMug} size={64} />
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
      className={cn('flex h-12 shrink-0 items-center gap-2.5 rounded-full border px-4 text-[0.95rem] font-semibold transition-colors duration-500', className)}
      style={{ borderColor: `color-mix(in oklab, ${lamp.hex} 50%, transparent)`, background: `color-mix(in oklab, ${lamp.hex} 12%, var(--card))` }}>
      <span className="relative -my-2 -ml-2">
        <ObjIcon name="lamp" fallback={IconLamp} size={38} />
        <span aria-hidden className="absolute bottom-1 left-1/2 size-2.5 -translate-x-1/2 rounded-full ring-1 ring-dusk/40" style={{ background: lamp.hex }} />
      </span>
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
