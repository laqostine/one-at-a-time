// Places: every table you sat at, on a map (light tiles, amber pins), and the list under it. A pin or a row opens
// that table's notes. Tables without a saved position are listed but not pinned.
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { listTables, type TableRow } from '@/lib/notesDb';
import { NotesPage } from './NotesPage';

const fmtDay = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function Map({ tables, onPick }: { tables: TableRow[]; onPick: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(m);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const pts = tables.filter((t) => t.lat != null && t.lng != null);
    const layer = L.layerGroup().addTo(m);
    for (const t of pts) {
      const pin = L.circleMarker([t.lat!, t.lng!], { radius: 11, color: '#17130F', weight: 2, fillColor: '#E4A73A', fillOpacity: 1 }).addTo(layer);
      pin.bindTooltip(`${t.location || 'Somewhere'} · ${fmtDay(t.startedAt)} · ${t.notes ?? 0} notes`, { direction: 'top', offset: [0, -10] });
      pin.on('click', () => onPick(t.id));
    }
    if (pts.length) m.fitBounds(L.latLngBounds(pts.map((t) => [t.lat!, t.lng!] as [number, number])).pad(0.4), { maxZoom: 15 });
    else m.setView([45.4642, 9.19], 12);
    return () => { layer.remove(); };
  }, [tables, onPick]);
  return <div ref={el} className="h-[46dvh] w-full rounded-xl border border-rule" aria-label="Map of your tables" />;
}

export function PlacesPage({ onClose }: { onClose: () => void }) {
  const [tables, setTables] = useState<TableRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const touchY = useRef<number | null>(null);
  useEffect(() => {
    let dead = false;
    listTables().then((t) => { if (!dead) setTables(t); }).catch((e: unknown) => { if (!dead) setErr(String((e as Error)?.message ?? e)); });
    return () => { dead = true; };
  }, []);
  const pinned = (tables ?? []).filter((t) => t.lat != null).length;
  return (
    <div role="dialog" aria-modal="true" aria-label="Places" className="oat-up font-notes fixed inset-0 z-50 overflow-y-auto bg-cream text-ink"
      onTouchStart={(e) => { touchY.current = e.touches[0].clientY; }}
      onTouchEnd={(e) => { const y0 = touchY.current; touchY.current = null; if (y0 != null && e.changedTouches[0].clientY - y0 > 70 && !open) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape' && !open) onClose(); }}>
      <div className="mx-auto flex min-h-full max-w-[640px] flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between pt-3">
          <button type="button" onClick={onClose} autoFocus aria-label="Back to the sentence"
            className="-mx-1 -my-2 cursor-pointer rounded-xl px-1 py-2 font-display-italic text-[18px] leading-none text-ink">One at a time</button>
          <button type="button" onClick={onClose} className="-mt-3 -mr-3 h-14 min-w-14 cursor-pointer rounded-xl px-3 font-bold text-ink-2 hover:text-ink">Back</button>
        </div>
        <h1 className="mt-6 mb-4 font-display-italic text-[2.353rem] leading-none">Places</h1>
        <Map tables={tables ?? []} onPick={setOpen} />
        <p className="oat-label mt-3">{tables ? `${tables.length} tables · ${pinned} on the map` : 'Loading…'}</p>
        {err && <p role="alert" className="mt-3 text-[1.06rem] text-ink-2">Couldn’t load your tables: {err}</p>}
        {tables && tables.length === 0 && <p className="mt-6 text-[1.06rem] text-ink-2">No tables yet. Start listening somewhere and the clerk’s notes land here, with the place and the date.</p>}
        {tables && tables.length > 0 && (
          <ul className="mt-4 divide-y divide-rule border-t border-rule" aria-label="Your tables">
            {tables.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setOpen(t.id)} className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-3 py-3 text-left">
                  <span className="min-w-0">
                    <span className="block truncate text-[1.176rem] font-medium text-ink">{t.location || 'Somewhere'}</span>
                    <span className="block text-[1rem] text-ink-2">{fmtDay(t.startedAt)}{t.me ? ` · ${t.me} read` : ''}{t.lat == null ? ' · no position' : ''}</span>
                  </span>
                  <span className="oat-label shrink-0">{t.notes ?? 0} notes ›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {open && <NotesPage id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
