import type {
  CatchupRequest, CatchupResponse, LaughRequest, LaughResponse, StateRequest, StateResponse,
} from '../../../shared/types';

export interface HealthResponse { ok: boolean; hasAnthropic: boolean; hasDeepgram: boolean; latencyMs?: number }

async function post<Req, Res>(path: string, body: Req, signal?: AbortSignal): Promise<Res> {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json() as Promise<Res>;
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
