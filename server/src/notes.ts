// Tables + notes taken: the only thing One at a time persists. One row per table (where, who read, when) and the
// notes the clerk took there (plans, asks, pushback, catch-ups). SQLite via node:sqlite at server/data/tables.db.
//   POST  /api/tables                {me, location?, lat?, lng?}     -> {id}
//   PATCH /api/tables/:id            {location?, lat?, lng?, ended?}  -> {ok}
//   PUT   /api/tables/:id/notes      {items: Note[]}                  -> {ok, count}   (upsert by note id)
//   GET   /api/tables                                                 -> {tables: [{id, me, location, startedAt, endedAt, notes}]}
//   GET   /api/tables/:id                                             -> {table, notes}
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

export interface TableRow { id: string; token: string; me: string; location: string; lat: number | null; lng: number | null; startedAt: number; endedAt: number | null; notes?: number }
export interface Note { id: string; kind: string; text: string; speaker?: string; t: number; reason?: string; resolved?: boolean }

const PATH = process.env.NOTES_DB ?? resolve(import.meta.dirname, '../data/tables.db');
let db: DatabaseSync | null = null;
function open(): DatabaseSync {
  if (db) return db;
  mkdirSync(dirname(PATH), { recursive: true });
  db = new DatabaseSync(PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY, token TEXT, me TEXT, location TEXT DEFAULT '', lat REAL, lng REAL,
      started_at INTEGER NOT NULL, ended_at INTEGER);
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY, table_id TEXT NOT NULL REFERENCES tables(id), kind TEXT NOT NULL, text TEXT NOT NULL,
      speaker TEXT, t INTEGER NOT NULL, reason TEXT, resolved INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS notes_table ON notes(table_id);`);
  return db;
}

export function createTable(p: { token: string; me: string; location?: string; lat?: number | null; lng?: number | null }): string {
  const id = randomUUID().slice(0, 8);
  open().prepare('INSERT INTO tables (id, token, me, location, lat, lng, started_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, p.token, p.me.slice(0, 40), (p.location ?? '').slice(0, 80), p.lat ?? null, p.lng ?? null, Date.now());
  return id;
}
export function patchTable(id: string, p: { location?: string; lat?: number | null; lng?: number | null; ended?: boolean }): boolean {
  const d = open();
  const cur = d.prepare('SELECT id FROM tables WHERE id = ?').get(id);
  if (!cur) return false;
  if (p.location != null) d.prepare('UPDATE tables SET location = ? WHERE id = ?').run(p.location.slice(0, 80), id);
  if (p.lat != null && p.lng != null) d.prepare('UPDATE tables SET lat = ?, lng = ? WHERE id = ?').run(p.lat, p.lng, id);
  if (p.ended) d.prepare('UPDATE tables SET ended_at = ? WHERE id = ?').run(Date.now(), id);
  return true;
}
export function putNotes(tableId: string, items: Note[]): number {
  const d = open();
  if (!d.prepare('SELECT id FROM tables WHERE id = ?').get(tableId)) return -1;
  const up = d.prepare(`INSERT INTO notes (id, table_id, kind, text, speaker, t, reason, resolved, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, text=excluded.text, speaker=excluded.speaker, reason=excluded.reason,
      resolved=excluded.resolved, updated_at=excluded.updated_at`);
  const now = Date.now();
  let n = 0;
  for (const it of items.slice(0, 200)) {
    if (!it?.id || !it.text?.trim()) continue;
    up.run(`${tableId}:${it.id}`.slice(0, 120), tableId, String(it.kind ?? 'note').slice(0, 24), it.text.trim().slice(0, 400),
      it.speaker?.slice(0, 40) ?? null, Math.round(it.t ?? 0), it.reason?.slice(0, 120) ?? null, it.resolved ? 1 : 0, now, now);
    n++;
  }
  return n;
}
function row(r: Record<string, unknown>): TableRow {
  return { id: String(r.id), token: String(r.token ?? ''), me: String(r.me ?? ''), location: String(r.location ?? ''),
    lat: r.lat == null ? null : Number(r.lat), lng: r.lng == null ? null : Number(r.lng),
    startedAt: Number(r.started_at), endedAt: r.ended_at == null ? null : Number(r.ended_at), notes: r.notes == null ? undefined : Number(r.notes) };
}
export function listTables(limit = 30): TableRow[] {
  return (open().prepare(`SELECT t.*, (SELECT COUNT(*) FROM notes n WHERE n.table_id = t.id) AS notes
    FROM tables t ORDER BY started_at DESC LIMIT ?`).all(limit) as Record<string, unknown>[]).map(row);
}
export function getTable(id: string): { table: TableRow; notes: Note[] } | null {
  const d = open();
  const t = d.prepare('SELECT * FROM tables WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!t) return null;
  const notes = (d.prepare('SELECT * FROM notes WHERE table_id = ? ORDER BY t ASC').all(id) as Record<string, unknown>[]).map((n) => ({
    id: String(n.id).slice(id.length + 1), kind: String(n.kind), text: String(n.text), speaker: n.speaker == null ? undefined : String(n.speaker),
    t: Number(n.t), reason: n.reason == null ? undefined : String(n.reason), resolved: !!n.resolved }));
  return { table: row(t), notes };
}

export function registerNotes(app: FastifyInstance, roomToken: () => string): void {
  app.post<{ Body: { me?: string; location?: string; lat?: number; lng?: number; token?: string } }>('/api/tables', async (req) => {
    const b = req.body ?? {};
    return { id: createTable({ token: (b.token ?? '').trim() || roomToken(), me: b.me ?? '', location: b.location, lat: b.lat, lng: b.lng }) };
  });
  app.patch<{ Params: { id: string }; Body: { location?: string; lat?: number; lng?: number; ended?: boolean } }>('/api/tables/:id', async (req, reply) => {
    if (!patchTable(req.params.id, req.body ?? {})) return reply.code(404).send({ ok: false });
    return { ok: true };
  });
  app.put<{ Params: { id: string }; Body: { items?: Note[] } }>('/api/tables/:id/notes', async (req, reply) => {
    const n = putNotes(req.params.id, req.body?.items ?? []);
    if (n < 0) return reply.code(404).send({ ok: false });
    return { ok: true, count: n };
  });
  app.post<{ Params: { id: string } }>('/api/tables/:id/end', async (req) => ({ ok: patchTable(req.params.id, { ended: true }) }));
  app.get('/api/tables', async () => ({ tables: listTables() }));
  app.get<{ Params: { id: string } }>('/api/tables/:id', async (req, reply) => getTable(req.params.id) ?? reply.code(404).send({ ok: false }));
}
