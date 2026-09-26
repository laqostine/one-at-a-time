import dotenv from 'dotenv';
dotenv.config({ path: new URL('../../.env', import.meta.url) });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import type { CatchupRequest, LaughRequest, StateRequest } from '../../shared/types.ts';
import { catchUp, extractState, explainLaugh, hasAnthropic } from './claude.ts';
import { registerAsr } from './asr.ts';
import { registerRooms, roomInfo } from './rooms.ts';
import { draftInterjections } from './interject.ts';
import { registerGate } from './gate.ts';

const app = Fastify({ logger: { level: 'info' }, bodyLimit: 5 * 1024 * 1024 });

await app.register(cors, { origin: true });
await app.register(websocket);
await registerAsr(app);
registerRooms(app);

app.get('/api/health', async () => {
  const t0 = Date.now();
  return { ok: true, hasAnthropic: hasAnthropic(), hasDeepgram: !!process.env.DEEPGRAM_API_KEY, latencyMs: Date.now() - t0 };
});

app.post<{ Body: CatchupRequest }>('/api/catchup', async (req) => {
  const t0 = Date.now();
  const out = await catchUp(req.body);
  return { ...out, latencyMs: Date.now() - t0 };
});

app.post<{ Body: StateRequest }>('/api/state', async (req) => {
  const t0 = Date.now();
  const out = await extractState(req.body);
  return { ...out, latencyMs: Date.now() - t0 };
});

registerGate(app); // POST /api/gate (fast System-One decision gate)

app.post<{ Body: LaughRequest }>('/api/laugh', async (req) => {
  const t0 = Date.now();
  const out = await explainLaugh(req.body);
  return { ...out, latencyMs: Date.now() - t0 };
});

// "Speak for me" (interjection assist)
app.post<{ Body: import('../../shared/types.ts').InterjectRequest }>('/api/interject', async (req) => {
  const t0 = Date.now();
  const out = await draftInterjections(req.body ?? ({} as never));
  return { ...out, latencyMs: Date.now() - t0 };
});

const port = Number(process.env.PORT) || 8787;
await app.listen({ port, host: '0.0.0.0' });
app.log.info(`anthropic=${hasAnthropic() ? 'live' : 'MOCK'} deepgram=${process.env.DEEPGRAM_API_KEY ? 'yes' : 'no'}`);
const ri = roomInfo();
console.log(`\n[room] Everyone joins → ${ri.joinUrl}  (token ${ri.token}; set PUBLIC_URL when tunneling)`);
