// ASR bridge: browser PCM16 (16kHz mono) over /ws/audio -> Deepgram streaming -> AsrMessage JSON back.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import WebSocket from 'ws';
import type { AsrMessage } from '../../shared/types';
import { isVoice, parseJoin, room } from './rooms';

const DG_URL =
  'wss://api.deepgram.com/v1/listen?model=nova-3&diarize=true&smart_format=true&interim_results=true' +
  '&utterance_end_ms=1000&vad_events=true&encoding=linear16&sample_rate=16000&channels=1';
// Participant phones: one voice per stream, so no diarization.
const DG_URL_SOLO = DG_URL.replace('diarize=true', 'diarize=false');

interface DgWord { word: string; punctuated_word?: string; start: number; end: number; speaker?: number; confidence?: number }
interface DgResults {
  type: 'Results';
  is_final?: boolean;
  channel?: { alternatives?: { transcript?: string; words?: DgWord[] }[] };
}

/** Split a Deepgram Results payload into one transcript message per contiguous speaker run. */
export function resultsToMessages(r: DgResults): AsrMessage[] {
  const words = r.channel?.alternatives?.[0]?.words ?? [];
  const out: AsrMessage[] = [];
  let run: DgWord[] = [];
  const flush = () => {
    if (!run.length) return;
    const text = run.map((w) => w.punctuated_word ?? w.word).join(' ').trim();
    if (text) {
      out.push({
        type: 'transcript',
        speaker: run[0].speaker ?? -1,
        text,
        tStart: Math.round(run[0].start * 1000),
        tEnd: Math.round(run[run.length - 1].end * 1000),
        final: !!r.is_final,
        // Finals only: per-word confidence so the UI can grey out doubtful words.
        ...(r.is_final ? {
          words: run.map((w) => ({
            w: w.punctuated_word ?? w.word,
            c: typeof w.confidence === 'number' ? Math.round(w.confidence * 1000) / 1000 : 1,
            t0: Math.round(w.start * 1000),
            t1: Math.round(w.end * 1000),
          })),
        } : {}),
      });
    }
    run = [];
  };
  for (const w of words) {
    if (run.length && (run[0].speaker ?? -1) !== (w.speaker ?? -1)) flush();
    // Also split at a sentence end followed by a pause, so "…by Friday?" and "None taken."
    // from the same phone don't merge into one line (seen in the live QA run).
    if (run.length) {
      const prev = run[run.length - 1];
      const endsSentence = /[.?!]["')\]]?$/.test(prev.punctuated_word ?? '');
      if (endsSentence && w.start - prev.end >= 0.6) flush();
    }
    run.push(w);
  }
  flush();
  return out;
}

const MAX_PENDING = 50; // ~5s of 100ms chunks buffered while Deepgram connects

/**
 * Registers WS route /ws/audio. Registers @fastify/websocket itself (in an encapsulated
 * child context) if it isn't already present on `app`. Safe to call without awaiting.
 */
export function registerAsr(app: FastifyInstance): void {
  app.register(async (inst) => {
    if (!inst.hasDecorator('websocketServer')) await inst.register(fastifyWebsocket);

    // ?role=host|participant&name=&token= — bad token => 401 before the upgrade.
    const preValidation = async (req: FastifyRequest, reply: FastifyReply) => {
      if (!parseJoin(req.url)) await reply.code(401).send({ error: 'bad room token or missing name' });
    };

    inst.get('/ws/audio', { websocket: true, preValidation }, (client, req) => {
      const join = parseJoin(req.url);
      if (!join) { client.close(4401, 'unauthorized'); return; }
      const participant = join.role === 'participant' ? join.room.addParticipant(client, join.name) : null;
      if (!participant) join.room.addHost(client);
      let dgOpenedAt = Date.now();
      const direct = (m: AsrMessage) => {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(m));
      };
      // Participant transcripts go to the room's host(s), never back to the phone.
      const send = (m: AsrMessage) => {
        if (participant && m.type === 'transcript') join.room.fromParticipant(participant, m, dgOpenedAt);
        else direct(m);
      };

      const key = process.env.DEEPGRAM_API_KEY;
      if (!key) {
        send({ type: 'status', state: 'error', detail: 'no DEEPGRAM_API_KEY' });
        client.close(1011, 'no DEEPGRAM_API_KEY');
        if (participant) join.room.removeParticipant(client); else join.room.removeHost(client);
        return;
      }

      send({ type: 'status', state: 'connecting' });
      const dg = new WebSocket(`${participant ? DG_URL_SOLO : DG_URL}&language=${room.lang}`, { headers: { Authorization: `Token ${key}` } });
      const pending: Buffer[] = [];
      let closed = false;
      let keepAlive: NodeJS.Timeout | undefined;

      const shutdown = (why: string) => {
        if (closed) return;
        closed = true;
        if (participant) join.room.removeParticipant(client);
        else join.room.removeHost(client);
        if (keepAlive) clearInterval(keepAlive);
        try {
          if (dg.readyState === WebSocket.OPEN) {
            dg.send(JSON.stringify({ type: 'CloseStream' }));
            setTimeout(() => dg.terminate(), 1500).unref();
          } else if (dg.readyState === WebSocket.CONNECTING) {
            dg.terminate();
          }
        } catch { /* ignore */ }
        send({ type: 'status', state: 'closed', detail: why });
        if (client.readyState === WebSocket.OPEN) client.close(1000, why.slice(0, 100));
      };

      dg.on('open', () => {
        if (closed) { dg.close(); return; }
        dgOpenedAt = Date.now();
        if (!participant) join.room.hostEpoch = dgOpenedAt;
        send({ type: 'status', state: 'open' });
        for (const b of pending.splice(0)) dg.send(b);
        keepAlive = setInterval(() => {
          if (dg.readyState === WebSocket.OPEN) dg.send(JSON.stringify({ type: 'KeepAlive' }));
        }, 8000);
      });

      dg.on('message', (data, isBinary) => {
        if (isBinary) return;
        let msg: { type?: string };
        try { msg = JSON.parse(data.toString()) as { type?: string }; } catch { return; }
        if (msg.type === 'Results') for (const m of resultsToMessages(msg as DgResults)) send(m);
      });

      dg.on('unexpected-response', (_r, res) => {
        send({ type: 'status', state: 'error', detail: `deepgram HTTP ${res.statusCode ?? '?'}` });
        shutdown('deepgram rejected');
      });
      dg.on('error', (err) => {
        req.log.warn({ err }, 'deepgram ws error');
        send({ type: 'status', state: 'error', detail: `deepgram: ${err.message}` });
        shutdown('deepgram error');
      });
      dg.on('close', (code, reason) => shutdown(`deepgram closed ${code} ${reason.toString()}`.trim()));

      client.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
        if (!isBinary) {
          try {
            const m = JSON.parse(data.toString()) as { type?: string };
            if (m.type === 'stop') shutdown('client stop');
          } catch { /* ignore */ }
          return;
        }
        const buf = Array.isArray(data) ? Buffer.concat(data) : Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (isVoice(buf)) {
          const ms = buf.length / 32; // PCM16 @ 16 kHz: 32 bytes per ms
          if (participant) { join.room.touch(participant); join.room.voice(participant.id, ms); }
          else join.room.hostVoice(ms);
        }
        if (dg.readyState === WebSocket.OPEN) dg.send(buf);
        else if (dg.readyState === WebSocket.CONNECTING) {
          pending.push(buf);
          if (pending.length > MAX_PENDING) pending.shift();
        }
      });
      client.on('close', () => shutdown('client closed'));
      client.on('error', () => shutdown('client error'));
    });
  });
}
