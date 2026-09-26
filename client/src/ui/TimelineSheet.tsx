import { fmtT, type TimelineItem } from '../../../shared/types';
import { isUtt } from '../state/session';
import { EventChip } from './EventChip';
import { Modal } from './Modal';
import { readable } from '@/lib/utils';

interface Props {
  t: number;
  items: TimelineItem[];
  nameOf: (id: number) => string;
  colorOf: (id: number) => string;
  onClose: () => void;
}

/** Verbatim lines ±15 s around a bullet / ledger item. */
export function TimelineSheet({ t, items, nameOf, colorOf, onClose }: Props) {
  return (
    <Modal title={`What was said around ${fmtT(t)}`} onClose={onClose} variant="sheet">
      {items.length ? (
        <ol className="space-y-1">
          {items.map((i) => {
            const at = isUtt(i) ? i.tStart : i.t;
            const near = Math.abs(at - t) < 2500;
            return (
              <li key={i.id} className={`flex gap-3 rounded-xl px-3 py-2 ${near ? 'bg-accent/10 ring-1 ring-accent/40' : ''}`}>
                <span className="w-12 shrink-0 pt-1 text-meta tabular-nums">{fmtT(at)}</span>
                {isUtt(i) ? (
                  <p className="text-body">
                    <strong style={{ color: readable(colorOf(i.speaker)) }}>{nameOf(i.speaker)}: </strong>{i.text}
                  </p>
                ) : <EventChip kind={i.kind} />}
              </li>
            );
          })}
        </ol>
      ) : <p className="text-muted">No lines in the buffer around that moment.</p>}
    </Modal>
  );
}
