// HTTP for single-phone voice enrollment (client/enroll.html). Audio body = raw PCM16 LE mono 16 kHz
// (Content-Type application/octet-stream), or a 16-bit mono WAV (header stripped; sample rate read from it).
//   POST   /api/voice/enroll?token=&name=   -> { ok, name, samples, selfScore, roster }
//   GET    /api/voice/roster?token=         -> { ok, available, roster: [{name, samples}], threshold, self, cross }
//          (threshold = midway between the least self-similar voice and the most alike pair, clamped 0.45-0.7)
//   DELETE /api/voice/enroll?token=&name=   -> { ok, removed, roster }
//   POST   /api/voice/identify?token=       -> identify() result (debug / manual testing)
import type { FastifyInstance, FastifyReply } from 'fastify';
import { room } from './rooms.ts';
import { calibration, enroll, identify, pcmMs, removeVoice, roster, voiceIdAvailable, voiceIdError } from './voiceid.ts';

const MIN_ENROLL_MS = 1_500;
const MAX_BODY = 30 * 16_000 * 2; // 30 s of 16 kHz PCM16

/** Token -> table key. Empty token = the default room (same rule as a host with no token). */
function tableFor(token: string | undefined): string | null {
  if (!token) return room.token;
  return token === room.token ? token : null;
}

/** Accept raw PCM16 or a PCM16 WAV; returns samples + rate. */
function parseAudio(body: Buffer, rateHint?: number): { pcm: Buffer; sampleRate: number } {
  if (body.length > 44 && body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WAVE') {
    let off = 12, sampleRate = 16_000;
    while (off + 8 <= body.length) {
      const id = body.toString('ascii', off, off + 4);
      const size = body.readUInt32LE(off + 4);
      if (id === 'fmt ') sampleRate = body.readUInt32LE(off + 12);
      if (id === 'data') return { pcm: body.subarray(off + 8, Math.min(body.length, off + 8 + size)), sampleRate };
      off += 8 + size + (size & 1);
    }
  }
  return { pcm: body.length & 1 ? body.subarray(0, body.length - 1) : body, sampleRate: rateHint || 16_000 };
}

function unavailable(reply: FastifyReply) {
  return reply.code(503).send({ ok: false, error: `voice id unavailable: ${voiceIdError() ?? 'model failed to load'}` });
}

export function registerVoiceId(app: FastifyInstance): void {
  void app.register(async (scope) => {
    // Encapsulated: raw audio bodies only inside this plugin; JSON routes elsewhere are untouched.
    for (const ct of ['application/octet-stream', 'audio/wav', 'audio/x-wav', 'audio/l16']) {
      scope.addContentTypeParser(ct, { parseAs: 'buffer', bodyLimit: MAX_BODY }, (_req, body, done) => done(null, body));
    }

    scope.get<{ Querystring: { token?: string } }>('/api/voice/roster', async (req, reply) => {
      const t = tableFor(req.query.token);
      if (!t) return reply.code(401).send({ ok: false, error: 'bad token' });
      return { ok: true, available: voiceIdAvailable(), roster: roster(t), ...calibration(t) };
    });

    scope.post<{ Querystring: { token?: string; name?: string; rate?: string }; Body: Buffer }>('/api/voice/enroll', async (req, reply) => {
      const t = tableFor(req.query.token);
      if (!t) return reply.code(401).send({ ok: false, error: 'bad token' });
      const name = (req.query.name ?? '').trim();
      if (!name) return reply.code(400).send({ ok: false, error: 'name required' });
      if (!Buffer.isBuffer(req.body)) return reply.code(415).send({ ok: false, error: 'send PCM16 as application/octet-stream' });
      if (!voiceIdAvailable()) return unavailable(reply);
      const { pcm, sampleRate } = parseAudio(req.body, Number(req.query.rate));
      const ms = pcmMs(pcm, sampleRate);
      if (ms < MIN_ENROLL_MS) return reply.code(400).send({ ok: false, error: `too short (${Math.round(ms)} ms)` });
      const t0 = Date.now();
      const r = enroll(t, name, pcm, sampleRate);
      req.log.info(`[voiceid] enroll "${r.name}" ${Math.round(ms)}ms samples=${r.samples} self=${r.selfScore?.toFixed(3) ?? '-'} ${Date.now() - t0}ms`);
      return { ok: true, name: r.name, samples: r.samples, selfScore: r.selfScore, roster: roster(t), ...calibration(t) };
    });

    scope.delete<{ Querystring: { token?: string; name?: string } }>('/api/voice/enroll', async (req, reply) => {
      const t = tableFor(req.query.token);
      if (!t) return reply.code(401).send({ ok: false, error: 'bad token' });
      const removed = removeVoice(t, (req.query.name ?? '').trim());
      return { ok: true, removed, roster: roster(t) };
    });

    scope.post<{ Querystring: { token?: string; rate?: string }; Body: Buffer }>('/api/voice/identify', async (req, reply) => {
      const t = tableFor(req.query.token);
      if (!t) return reply.code(401).send({ ok: false, error: 'bad token' });
      if (!Buffer.isBuffer(req.body)) return reply.code(415).send({ ok: false, error: 'send PCM16 as application/octet-stream' });
      if (!voiceIdAvailable()) return unavailable(reply);
      const { pcm, sampleRate } = parseAudio(req.body, Number(req.query.rate));
      const t0 = Date.now();
      return { ok: true, ...identify(t, pcm, { sampleRate }), latencyMs: Date.now() - t0 };
    });
  });
}
