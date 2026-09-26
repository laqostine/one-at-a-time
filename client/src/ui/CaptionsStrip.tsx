import { useEffect, useRef, useState } from 'react';
import { Captions, ChevronDown, ChevronUp } from 'lucide-react';
import type { TimelineItem } from '../../../shared/types';
import { isUtt } from '../state/session';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EventChip } from './EventChip';
import { SpeakerChip } from './SpeakerChip';

interface Props {
  items: TimelineItem[];
  nameOf: (id: number) => string;
  colorOf: (id: number) => string;
  onSpeaker: (id: number) => void;
}

const SHOW = 60;

/** Collapsible diarized live captions with inline event chips. Secondary view: the only scrolling surface. Autoscroll pauses on hover/scroll-up. */
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
    <section aria-label="Live captions" className="shrink-0 overflow-hidden rounded-2xl border border-border bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="imt-captions"
        className="flex h-12 w-full cursor-pointer items-center gap-2.5 px-4 text-left transition-colors duration-150 hover:bg-card-2">
        <Captions size={18} className="text-muted" aria-hidden />
        <span className="card-label">Live captions</span>
        {hover && open && <Badge variant="outline" className="text-muted">paused</Badge>}
        <span className="ml-auto flex items-center gap-1 text-meta">
          {open ? 'Hide' : 'Show'}
          {open ? <ChevronDown size={18} aria-hidden /> : <ChevronUp size={18} aria-hidden />}
        </span>
      </button>
      {open && (
        <ScrollArea id="imt-captions" viewportRef={box}
          onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          viewportProps={{
            tabIndex: 0, 'aria-label': 'Caption history',
            onScroll: (e) => { const el = e.currentTarget; pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; },
          }}
          className="h-[30dvh] border-t border-border">
          <div className="px-4 py-3">
            {recent.length === 0 && <p className="text-body text-muted">No captions yet.</p>}
            <ul className="space-y-2.5">
              {recent.map((i) => (
                <li key={i.id} className="flex items-start gap-2.5">
                  {isUtt(i) ? (
                    <>
                      <span className="pt-0.5"><SpeakerChip size="sm" name={nameOf(i.speaker)} color={colorOf(i.speaker)}
                        onClick={i.speaker >= 0 ? () => onSpeaker(i.speaker) : undefined} /></span>
                      <span className={cn('text-body', !i.final && 'text-muted italic', i.addressedToMe && 'font-semibold text-warn')}>{i.text}</span>
                    </>
                  ) : <EventChip kind={i.kind} />}
                </li>
              ))}
            </ul>
          </div>
        </ScrollArea>
      )}
    </section>
  );
}
