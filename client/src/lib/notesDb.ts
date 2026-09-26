import { roomToken } from '@/lib/room';
// Tables + notes taken (server SQLite, /api/tables). The listener's session opens a table row on Start, upserts the
// clerk's notes (ledger + catch-up bullets) as they change, and closes the row on leave. Location is a label from
// Settings plus, if the person taps "Use my position", the browser's coordinates.
import { useEffect, useRef } from 'react';
import type { CatchupResponse, LedgerItem } from '../../../shared/types';

export interface TableRow { id: string; me: string; location: string; lat: number | null; lng: number | null; startedAt: number; endedAt: number | null; notes?: number }
export interface NoteRow { id: string; kind: string; text: string; speaker?: string; t: number; reason?: string; resolved?: boolean }

const json = (body: unknown) => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export async function listTables(): Promise<TableRow[]> {
  const r = await fetch('/api/tables');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return ((await r.json()) as { tables: TableRow[] }).tables;
}
export async function getTable(id: string): Promise<{ table: TableRow; notes: NoteRow[] }> {
  const r = await fetch(`/api/tables/${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<{ table: TableRow; notes: NoteRow[] }>;
}
export function locate(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((res) => {
    if (!('geolocation' in navigator)) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { timeout: 8000, maximumAge: 60_000 });
  });
}

/** Open a table row once `started`, keep its notes in sync (debounced 2 s), close it on unload. */
export function useNotesDb(opts: { started: boolean; me: string; location: string; ledger: LedgerItem[]; lastCatchup: CatchupResponse | null }): { tableId: string | null; setPosition: (p: { lat: number; lng: number }) => void } {
  const id = useRef<string | null>(null);
  const pending = useRef<number | null>(null);
  const { started, me, location, ledger, lastCatchup } = opts;
  const catchups = useRef<CatchupResponse[]>([]);
  if (lastCatchup && catchups.current[catchups.current.length - 1] !== lastCatchup) catchups.current = [...catchups.current, lastCatchup].slice(-40);

  useEffect(() => {
    if (!started || id.current) return;
    let dead = false;
    fetch('/api/tables', { method: 'POST', ...json({ me, location, token: roomToken() }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { id?: string } | null) => { if (!dead && j?.id) id.current = j.id; })
      .catch(() => { /* offline: nothing is saved */ });
    return () => { dead = true; };
  }, [started]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id.current) return;
    void fetch(`/api/tables/${id.current}`, { method: 'PATCH', ...json({ location }) }).catch(() => {});
  }, [location]);

  useEffect(() => {
    if (!id.current) return;
    if (pending.current) window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => {
      const items: NoteRow[] = [
        ...ledger.filter((l) => !l.provisional).map((l) => ({ id: l.id, kind: l.kind, text: l.text, speaker: l.speaker, t: l.t, reason: l.reason, resolved: l.resolved })),
        ...catchups.current.flatMap((c, i) => c.bullets.map((b, k) => ({ id: `missed-${i}-${k}`, kind: 'missed', text: b.text, speaker: b.speaker, t: b.t ?? 0 }))),
      ];
      if (!items.length || !id.current) return;
      void fetch(`/api/tables/${id.current}/notes`, { method: 'PUT', ...json({ items }) }).catch(() => {});
    }, 2000);
  }, [ledger, lastCatchup]);

  useEffect(() => {
    const close = () => { if (id.current) navigator.sendBeacon?.(`/api/tables/${id.current}/end`); };
    window.addEventListener('pagehide', close);
    return () => window.removeEventListener('pagehide', close);
  }, []);

  return {
    tableId: id.current,
    setPosition: (p) => { if (id.current) void fetch(`/api/tables/${id.current}`, { method: 'PATCH', ...json(p) }).catch(() => {}); },
  };
}
