import { fmtT, type TimelineItem } from '../../../shared/types';
import { isUtt } from '../state/session';
import { EventChip } from './EventChip';
import { Modal } from './Modal';

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
        <ol className="space-y-3">
          {items.map((i) => {
            const at = isUtt(i) ? i.tStart : i.t;
            const near = Math.abs(at - t) < 2500;
            return (
              <li key={i.id} className={`flex gap-3 rounded-lg px-2 py-1 ${near ? 'bg-card-2' : ''}`}>
                <span className="w-12 shrink-0 pt-0.5 text-[0.8rem] text-muted tabular-nums">{fmtT(at)}</span>
                {isUtt(i) ? (
                  <p className="text-[1.1rem] leading-snug">
                    <strong style={{ color: colorOf(i.speaker) }}>{nameOf(i.speaker)}: </strong>{i.text}
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
