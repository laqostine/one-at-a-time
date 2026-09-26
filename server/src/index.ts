import dotenv from 'dotenv';
dotenv.config({ path: new URL('../../.env', import.meta.url) });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import type { CatchupRequest, LaughRequest, StateRequest } from '../../shared/types.ts';
import { CATCHUP_BUDGET_MS, STATE_BUDGET_MS, catchUp, extractState, explainLaugh, hasAnthropic } from './claude.ts';
import { registerAsr } from './asr.ts';
import { registerRooms, room, roomInfo } from './rooms.ts';
import { draftInterjections } from './interject.ts';
import { registerGate } from './gate.ts';

/** Route-level backstop: whatever happens upstream, answer within `ms` with a degraded fallback so the UI never hangs. */
function deadline<T>(p: Promise<T>, ms: number, fallback: () => T, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<T>((res) => { timer = setTimeout(() => { console.warn(`[${label}] route deadline ${ms}ms hit`); res(fallback()); }, ms); });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

const app = Fastify({ logger: { level: 'info' }, bodyLimit: 5 * 1024 * 1024 });

await app.register(cors, { origin: true });
await app.register(websocket);
await registerAsr(app);
registerRooms(app);

app.get('/api/health', async () => {
  const t0 = Date.now();
  return { ok: true, hasAnthropic: hasAnthropic(), hasDeepgram: !!process.env.DEEPGRAM_API_KEY, room: room.stats(), latencyMs: Date.now() - t0 };
});

app.post<{ Body: CatchupRequest }>('/api/catchup', async (req) => {
  const t0 = Date.now();
  const out = await deadline(catchUp(req.body ?? ({} as CatchupRequest)), CATCHUP_BUDGET_MS + 1_000,
    () => ({ addressed_to_me: null, bullets: [], open_threads: [], confidence: 'low' as const, degraded: true }), 'catchup');
  const latencyMs = Date.now() - t0;
  req.log.info(`[catchup] ${latencyMs}ms win=${req.body?.window?.length ?? 0} -> bullets=${out.bullets.length}${out.degraded ? ' DEGRADED' : ''}`);
  return { ...out, latencyMs };
});

app.post<{ Body: StateRequest }>('/api/state', async (req) => {
  const t0 = Date.now();
  const b = req.body ?? ({} as StateRequest);
  const out = await deadline(extractState(b), STATE_BUDGET_MS + 500,
    () => ({ ledger: b.existing ?? [], addressed_to_me_now: null, threads: b.existing_threads ?? [], utteranceThreads: [], degraded: true }), 'state');
  const latencyMs = Date.now() - t0;
  req.log.info(`[state] ${latencyMs}ms win=${b.window?.length ?? 0} existing=${b.existing?.length ?? 0} -> ledger=${out.ledger.length}${out.degraded ? ' DEGRADED' : ''}`);
  return { ...out, latencyMs };
});

registerGate(app); // POST /api/gate (fast System-One decision gate)
(await import('./voiceid-routes.ts')).registerVoiceId(app); // single-phone mode: /api/voice/* (enroll, roster)

app.post<{ Body: LaughRequest }>('/api/laugh', async (req) => {
  const t0 = Date.now();
  const out = await deadline(explainLaugh(req.body ?? ({} as LaughRequest)), 6_000, () => ({ line: null }), 'laugh');
  return { ...out, latencyMs: Date.now() - t0 };
});

// "Speak for me" (interjection assist)
app.post<{ Body: import('../../shared/types.ts').InterjectRequest }>('/api/interject', async (req) => {
  const t0 = Date.now();
  const out = await deadline(draftInterjections(req.body ?? ({} as never)), 8_000, () => ({ options: [] }), 'interject');
  return { ...out, latencyMs: Date.now() - t0 };
});

const port = Number(process.env.PORT) || 8787;
await app.listen({ port, host: '0.0.0.0' });
app.log.info(`anthropic=${hasAnthropic() ? 'live' : 'MOCK'} deepgram=${process.env.DEEPGRAM_API_KEY ? 'yes' : 'no'}`);
const ri = roomInfo();
console.log(`\n[room] Everyone joins → ${ri.joinUrl}  (token ${ri.token}; set PUBLIC_URL when tunneling)`);
