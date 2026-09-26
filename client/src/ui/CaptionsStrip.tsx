import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { TimelineItem } from '../../../shared/types';
import { isUtt } from '../state/session';
import { EventChip } from './EventChip';
import { SpeakerChip } from './SpeakerChip';

interface Props {
  items: TimelineItem[];
  nameOf: (id: number) => string;
  colorOf: (id: number) => string;
  onSpeaker: (id: number) => void;
}

const SHOW = 60;

/** Collapsible diarized live captions with inline event chips. Autoscroll pauses on hover/scroll-up. */
export function CaptionsStrip({ items, nameOf, colorOf, onSpeaker }: Props) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const recent = items.slice(-SHOW);

  useEffect(() => {
    const el = box.current;
    if (el && open && !hover && pinned.current) el.scrollTop = el.scrollHeight;
  }, [recent, open, hover]);

  return (
    <section aria-label="Live captions" className="shrink-0 rounded-2xl border border-line bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-2.5 text-[0.9rem] font-semibold text-muted hover:text-fg">
        Live captions {hover && open && <span className="font-normal">(paused)</span>}
        {open ? <ChevronDown size={20} aria-hidden /> : <ChevronUp size={20} aria-hidden />}
      </button>
      {open && (
        <div ref={box} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          onScroll={(e) => { const el = e.currentTarget; pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}
          className="h-[30dvh] overflow-y-auto border-t border-line px-3 py-2" tabIndex={0} aria-label="Caption history">
          {recent.length === 0 && <p className="text-muted">No captions yet.</p>}
          <ul className="space-y-2">
            {recent.map((i) => (
              <li key={i.id} className="flex items-start gap-2">
                {isUtt(i) ? (
                  <>
                    <SpeakerChip size="sm" name={nameOf(i.speaker)} color={colorOf(i.speaker)}
                      onClick={i.speaker >= 0 ? () => onSpeaker(i.speaker) : undefined} />
                    <span className={`text-[1.05rem] leading-snug ${i.final ? '' : 'text-muted italic'} ${i.addressedToMe ? 'font-semibold text-warn' : ''}`}>{i.text}</span>
                  </>
                ) : <EventChip kind={i.kind} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
