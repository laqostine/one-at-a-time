// The table this phone belongs to. The listener's phone creates a table (POST /api/rooms -> 4-letter code) and keeps
// the code in localStorage; every room-scoped call carries it as ?token=. Other phones type the code to join.
const KEY = 'imt.room';

export function roomToken(): string {
  try {
    const q = new URLSearchParams(window.location.search).get('table');
    if (q && q.trim()) { const t = q.trim().toUpperCase(); localStorage.setItem(KEY, t); return t; }
    return localStorage.getItem(KEY) ?? '';
  } catch { return ''; }
}
export function setRoomToken(t: string): void { try { localStorage.setItem(KEY, t); } catch { /* ignore */ } }
export function clearRoomToken(): void { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

/** Append the table code to a same-origin API path. */
export function api(path: string): string {
  const t = roomToken();
  if (!t) return path;
  return `${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(t)}`;
}

export async function createRoom(): Promise<string> {
  const r = await fetch('/api/rooms', { method: 'POST' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = (await r.json()) as { token: string };
  setRoomToken(j.token);
  return j.token;
}

/** Make sure this listener phone has a table; returns its code ('' when offline). */
export async function ensureRoom(): Promise<string> {
  const have = roomToken();
  if (have) {
    try { const r = await fetch(`/api/room/verify?token=${encodeURIComponent(have)}`); if (r.ok) return have; } catch { return have; }
  }
  try { return await createRoom(); } catch { return ''; }
}
