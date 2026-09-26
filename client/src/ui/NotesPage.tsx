// A past table: where and when, and the notes the clerk took there. Same typography as "The table": hairlines, no cards.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getTable, type NoteRow, type TableRow } from '@/lib/notesDb';

const PREFIX: Record<string, string> = { objection: 'Pushback', open_question: 'Question', instruction_change: 'Changed', assigned_to_me: 'Asked of you', missed: 'Missed' };
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const fmtT = (t: number) => { const s = Math.floor(t / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-rule py-6" aria-label={title}>
      <h2 className="oat-label mb-4">{title}</h2>
      {children}
    </section>
  );
}
const Empty = ({ children }: { children: ReactNode }) => <p className="text-[1.06rem] text-ink-2">{children}</p>;

function Line({ n }: { n: NoteRow }) {
  const prefix = PREFIX[n.kind];
  return (
    <li className="py-3">
      <p className="text-[1.176rem] leading-snug text-ink">{prefix && <span className="oat-label mr-2">{prefix}</span>}{n.text}</p>
      <p className="mt-1 text-[1rem] text-ink-2">{n.speaker ?? 'The table'} · {fmtT(n.t)}{n.reason ? ` · ${n.reason}` : ''}</p>
    </li>
  );
}

export function NotesPage({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<{ table: TableRow; notes: NoteRow[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const touchY = useRef<number | null>(null);
  useEffect(() => {
    let dead = false;
    getTable(id).then((d) => { if (!dead) setData(d); }).catch((e: unknown) => { if (!dead) setErr(String((e as Error)?.message ?? e)); });
    return () => { dead = true; };
  }, [id]);
  const t = data?.table;
  const notes = data?.notes ?? [];
  const plans = notes.filter((n) => n.kind === 'decision' || n.kind === 'objection' || n.kind === 'open_question' || n.kind === 'instruction_change');
  const asked = notes.filter((n) => n.kind === 'assigned_to_me');
  const missed = notes.filter((n) => n.kind === 'missed');
  const other = notes.filter((n) => !plans.includes(n) && !asked.includes(n) && !missed.includes(n));
  return (
    <div role="dialog" aria-modal="true" aria-label="A past table" className="oat-up font-notes fixed inset-0 z-[90] overflow-y-auto bg-cream text-ink"
      onTouchStart={(e) => { touchY.current = e.touches[0].clientY; }}
      onTouchEnd={(e) => { const y0 = touchY.current; touchY.current = null; if (y0 != null && e.changedTouches[0].clientY - y0 > 70) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="mx-auto flex min-h-full max-w-[640px] flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between pt-3">
          <button type="button" onClick={onClose} autoFocus aria-label="Back to settings"
            className="-mx-1 -my-2 cursor-pointer rounded-xl px-1 py-2 font-display-italic text-[18px] leading-none text-ink">One at a time</button>
          <button type="button" onClick={onClose} className="-mt-3 -mr-3 h-14 min-w-14 cursor-pointer rounded-xl px-3 font-bold text-ink-2 hover:text-ink">Back</button>
        </div>
        <header className="py-8">
          <h1 className="font-display-italic text-[2.353rem] leading-none">{t?.location || 'Somewhere'}</h1>
          {t && (
            <p className="mt-3 text-[1.06rem] text-ink-2">
              {fmtDate(t.startedAt)} · {fmtTime(t.startedAt)}{t.endedAt ? `–${fmtTime(t.endedAt)}` : ' · still open'}{t.me ? ` · ${t.me} read` : ''}
              {t.lat != null && t.lng != null && (
                <> · <a className="underline underline-offset-4" href={`https://www.openstreetmap.org/?mlat=${t.lat}&mlon=${t.lng}#map=17/${t.lat}/${t.lng}`} target="_blank" rel="noreferrer">map</a></>
              )}
            </p>
          )}
          {err && <p role="alert" className="mt-3 text-[1.06rem] text-ink-2">Couldn’t load this table: {err}</p>}
          {data && notes.length === 0 && <p className="mt-3 text-[1.06rem] text-ink-2">The clerk took no notes at this table.</p>}
        </header>
        {plans.length > 0 && <Section title="Plans"><ul className="divide-y divide-rule">{plans.map((n) => <Line key={n.id} n={n} />)}</ul></Section>}
        {asked.length > 0 && <Section title="Asked of you"><ul className="divide-y divide-rule">{asked.map((n) => <Line key={n.id} n={n} />)}</ul></Section>}
        {missed.length > 0 && <Section title="What you missed"><ul className="divide-y divide-rule">{missed.map((n) => <Line key={n.id} n={n} />)}</ul></Section>}
        {other.length > 0 && <Section title="Notes"><ul className="divide-y divide-rule">{other.map((n) => <Line key={n.id} n={n} />)}</ul></Section>}
        {!data && !err && <Empty>Loading…</Empty>}
      </div>
    </div>
  );
}
