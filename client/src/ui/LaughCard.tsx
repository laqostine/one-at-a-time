// "Why they laughed": the Punchline Card. When the table laughs, the line said just before the
// laugh is pinned here, so you get the joke a few seconds late instead of never. Sources: laughter
// events on the timeline (+ the utterance before them) and catch-up bullets of kind 'joke'.
// Other sounds (doorbell, alarm, ...) keep a one-line trace at the bottom, like the old Sounds cell.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AudioEvent, TimelineItem, Utterance } from '../../../shared/types';
import type { CatchupState } from '../state/useSession';
import { eventMeta } from './EventChip';
import { IconLaugh } from './icons';
import { cn, readable } from '@/lib/utils';

interface Props {
  items: TimelineItem[];
  catchup: CatchupState;
  nameOf: (id: number) => string;
  colorOf: (id: number) => string;
  colorFor: (name?: string) => string;
  getNow: () => number;
  onOpen: (t: number) => void;
  /** 'dish' = desktop card; 'strip' = one tappable line (phones), in place of the old sounds strip. */
  variant?: 'dish' | 'strip';
  className?: string;
}

interface Joke { key: string; t: number; speaker?: string; color: string; text: string }

export function LaughCard({ items, catchup, nameOf, colorOf, colorFor, getNow, onOpen, variant = 'dish', className }: Props) {
  // Pin the joke when the laugh ARRIVES: the latest finished line at that moment is what they laughed at.
  // (Arrival order is robust even when event and utterance clocks differ, e.g. a sped-up replay.)
  const pinned = useRef(new Map<string, Utterance | null>());
  const { jokes, sounds } = useMemo(() => {
    const out: Joke[] = [];
    const other: AudioEvent[] = [];
    let latest: Utterance | undefined;
    for (const it of items) if (it.type !== 'event' && it.final && it.text.trim() && (!latest || it.tEnd > latest.tEnd)) latest = it;
    items.forEach((it) => {
      if (it.type !== 'event') return;
      if (it.kind !== 'laughter') { other.push(it); return; }
      if (!pinned.current.has(it.id)) {
        pinned.current.set(it.id, latest ?? null);
      }
      const u = pinned.current.get(it.id);
      out.push(u
        ? { key: it.id, t: u.tStart, speaker: nameOf(u.speaker), color: colorOf(u.speaker), text: u.text }
        : { key: it.id, t: it.t, color: 'var(--line-strong)', text: 'The table laughed. Nothing was said just before it.' });
    });
    if (catchup.status === 'ready') {
      for (const b of catchup.data.bullets) {
        if (b.kind !== 'joke') continue;
        if (out.some((j) => b.t != null && Math.abs(j.t - b.t) < 3000)) continue;
        out.push({ key: `cu-${b.t}-${b.text}`, t: b.t ?? 0, speaker: b.speaker, color: colorFor(b.speaker), text: b.text });
      }
    }
    out.sort((a, b) => a.t - b.t);
    return { jokes: out, sounds: other.slice(-3).reverse() };
  }, [items, catchup, nameOf, colorOf, colorFor]);

  const [nowT, setNowT] = useState(getNow);
  const has = jokes.length > 0 || sounds.length > 0;
  useEffect(() => {
    if (!has) return;
    setNowT(getNow());
    const id = window.setInterval(() => setNowT(getNow()), 5000);
    return () => window.clearInterval(id);
  }, [has, getNow, items]);
  const ago = (t: number) => { const s = Math.max(0, Math.round((nowT - t) / 1000)); return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`; };

  const last = jokes[jokes.length - 1];
  const earlier = jokes.slice(-2, -1);

  if (variant === 'strip') {
    if (!last && !sounds.length) return null;
    return (
      <div role="group" aria-label="Why they laughed" className={cn('flex h-10 shrink-0 items-center gap-2 overflow-hidden px-1', className)}>
        {last ? (
          <button type="button" onClick={() => onOpen(last.t)} aria-label={`The table laughed at ${last.speaker ? `${last.speaker}: ` : ''}${last.text}. Show what was said.`}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl py-1 text-left">
            <IconLaugh size={22} strokeWidth={2} className="shrink-0 text-[#edbc8f]" />
            <span className="shrink-0 text-[0.9rem] text-muted">They laughed at{last.speaker ? <> <strong style={{ color: readable(last.color) }}>{last.speaker}</strong></> : null}:</span>
            <q className="min-w-0 truncate font-display text-[1.15rem] text-fg">{last.text}</q>
          </button>
        ) : sounds.map((e) => { const m = eventMeta(e.kind); return (
          <span key={e.id} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-change/30 bg-change/10 px-2 py-0.5 text-[0.85rem] text-change"><m.icon size={13} aria-hidden />{m.label} · {ago(e.t)}</span>
        ); })}
      </div>
    );
  }

  return (
    <section aria-label="Why they laughed" className={cn('dish flex min-h-0 flex-col overflow-hidden rounded-3xl p-4 sm:p-5', className)}>
      <h2 className="flex items-center gap-2 card-label text-[#efd6b5]!">
        <span className="flex size-8 items-center justify-center rounded-full bg-[#c68c5b]/20 text-[#edbc8f]"><IconLaugh size={20} strokeWidth={2} /></span>
        Why they laughed
        {jokes.length > 1 && <span className="ml-auto font-mono text-[0.7rem] text-muted tabular-nums">{jokes.length} laughs</span>}
      </h2>
      <div aria-live="polite" className="mt-2.5 min-h-0 flex-1 overflow-hidden">
        {last ? (
          <button key={last.key} type="button" onClick={() => onOpen(last.t)}
            aria-label={`The table laughed at ${last.speaker ? `${last.speaker}: ` : ''}${last.text}. Show what was said.`}
            className="imt-in block w-full cursor-pointer rounded-2xl px-1 py-1 text-left transition-colors duration-150 hover:bg-white/[0.04]">
            <span className="block text-meta">The table laughed at{last.speaker ? <> <strong style={{ color: readable(last.color) }}>{last.speaker}</strong></> : null}, {ago(last.t)}:</span>
            <q className="mt-1 line-clamp-3 block font-display text-[1.45rem] leading-[1.15] text-fg">{last.text}</q>
          </button>
        ) : (
          <p className="px-1 text-[1rem] leading-snug text-muted">When the table laughs, the line that got the laugh lands here.</p>
        )}
        {earlier.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-line/70 pt-2">
            {earlier.map((j) => (
              <li key={j.key}>
                <button type="button" onClick={() => onOpen(j.t)} className="flex w-full cursor-pointer gap-2 rounded-lg px-1 py-0.5 text-left text-[0.95rem] text-muted hover:text-fg">
                  <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: j.color }} />
                  <span className="line-clamp-1">{j.speaker ? `${j.speaker}: ` : ''}{j.text}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {sounds.length > 0 && (
        <p className="mt-2 flex shrink-0 flex-wrap items-center gap-1.5 border-t border-line/70 pt-2 text-[0.85rem] text-muted" aria-label="Other sounds">
          {sounds.map((e) => { const m = eventMeta(e.kind); return (
            <span key={e.id} className="inline-flex items-center gap-1 rounded-full border border-change/30 bg-change/10 px-2 py-0.5 text-change"><m.icon size={13} aria-hidden />{m.label} · {ago(e.t)}</span>
          ); })}
        </p>
      )}
    </section>
  );
}
