import { api } from '../lib/room';
import type { InterjectRequest, InterjectResponse } from '../../../shared/types';
import type {
  CatchupRequest, CatchupResponse, LaughRequest, LaughResponse, StateRequest, StateResponse,
} from '../../../shared/types';

export interface HealthResponse { ok: boolean; hasAnthropic: boolean; hasDeepgram: boolean; latencyMs?: number }

/** Client-side backstop so a hung request can never freeze a spinner (server routes answer in <= ~11 s). */
const CLIENT_TIMEOUT_MS = 15_000;
async function post<Req, Res>(path: string, body: Req, signal?: AbortSignal): Promise<Res> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error(`${path} timed out`)), CLIENT_TIMEOUT_MS);
  const onAbort = () => ac.abort(signal?.reason);
  if (signal) { if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true }); }
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ac.signal });
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    return await (res.json() as Promise<Res>);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export const postCatchup = (req: CatchupRequest, signal?: AbortSignal) => post<CatchupRequest, CatchupResponse>('/api/catchup', req, signal);
export const postState = (req: StateRequest, signal?: AbortSignal) => post<StateRequest, StateResponse>('/api/state', req, signal);
export const postLaugh = (req: LaughRequest, signal?: AbortSignal) =>
  post<LaughRequest, LaughResponse & { latencyMs?: number }>('/api/laugh', req, signal);

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch('/api/health', { signal });
  if (!res.ok) throw new Error(`/api/health ${res.status}`);
  return res.json() as Promise<HealthResponse>;
}

// "Speak for me" (interjection assist)
export const postInterject = (req: InterjectRequest, signal?: AbortSignal) =>
  post<InterjectRequest, InterjectResponse>('/api/interject', req, signal);

// "Say" card (text-first Speak for me): shows ME's line full-screen on every joined phone.
export async function postSay(text: string, signal?: AbortSignal): Promise<{ ok: boolean; delivered: number }> {
  return post<{ text: string }, { ok: boolean; delivered: number }>(api('/api/room/say'), { text }, signal);
}
