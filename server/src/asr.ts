// ASR bridge: browser PCM16 (16kHz mono) over /ws/audio -> Deepgram streaming -> AsrMessage JSON back.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import WebSocket from 'ws';
import type { AsrMessage } from '../../shared/types';
import { parseJoin, Vad } from './rooms';

const DG_URL =
  'wss://api.deepgram.com/v1/listen?model=nova-3&diarize=true&smart_format=true&interim_results=true' +
  '&utterance_end_ms=1000&vad_events=true&encoding=linear16&sample_rate=16000&channels=1' +
  // Default endpointing is 10 ms, which finalized at every comma: 41 finals for 23 scripted lines ("Okay." "Focus."
  // "Who's bringing dessert?"), one /api/gate call each. 500 ms + the fragment coalescing below keeps a turn together.
  '&endpointing=400';
// Participant phones: one voice per stream, so no diarization.
const DG_URL_SOLO = DG_URL.replace('diarize=true', 'diarize=false');

interface DgWord { word: string; punctuated_word?: string; start: number; end: number; speaker?: number; confidence?: number }
interface DgResults {
  type: 'Results';
  is_final?: boolean;
  speech_final?: boolean;
  channel?: { alternatives?: { transcript?: string; words?: DgWord[] }[] };
}

/** Split a Deepgram Results payload into one transcript message per contiguous speaker run. */
export function resultsToMessages(r: DgResults): AsrMessage[] {
  const words = r.channel?.alternatives?.[0]?.words ?? [];
  const out: AsrMessage[] = [];
  let run: DgWord[] = [];
  const flush = () => {
    if (!run.length) return;
    // smart_format renders "one o'clock" as "01:00"; drop the leading zero so it reads "1:00".
    const text = run.map((w) => w.punctuated_word ?? w.word).join(' ').trim().replace(/\b0(\d:\d\d)\b/g, '$1');
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
            w: (w.punctuated_word ?? w.word).replace(/^0(\d:\d\d)/, '$1'),
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

const MAX_PENDING = 80; // ~8s of 100ms chunks buffered while Deepgram (re)connects
const DG_RECONNECTS = 3;           // consecutive Deepgram reconnect attempts before giving up on a socket
const DG_BACKOFF_MS = [250, 1000, 2500];
const KEEPALIVE_MS = 4_000;        // Deepgram closes after ~10 s without audio; phones pause audio when backgrounded
const PING_MS = 15_000;            // WS heartbeat: two missed pongs => the phone is gone (half-open TCP)
const HOLD_MAX_MS = 2_500;         // coalesced is_final fragments flush after this even without speech_final

/**
 * Deepgram sends is_final fragments inside one turn and speech_final at the endpoint. Hold fragments and emit ONE
 * final per turn (speech_final / UtteranceEnd / timeout / stream end); meanwhile show held+new words as an interim
 * so the caption never goes backwards.
 */
export class Coalescer {
  private held: DgWord[] = [];
  private timer: NodeJS.Timeout | undefined;
  /** maxSpanS: hard cap on a held turn. The host mic hears nonstop crosstalk (no endpoint for a long time), so it
   *  uses a short cap; a phone hears one person and can hold a whole turn. */
  constructor(private emit: (m: AsrMessage) => void, private maxSpanS = 8) {}
  private out(words: DgWord[], final: boolean) {
    for (const m of resultsToMessages({ type: 'Results', is_final: final, channel: { alternatives: [{ words }] } })) this.emit(m);
  }
  results(r: DgResults): void {
    const words = r.channel?.alternatives?.[0]?.words ?? [];
    if (!r.is_final) {
      if (!words.length) return;
      this.out([...this.held, ...words], false);
      if (this.timer) this.arm(); // still talking: push the safety flush out
      return;
    }
    this.held.push(...words);
    const last = this.held[this.held.length - 1];
    const span = this.held.length ? last.end - this.held[0].start : 0;
    // Flush at the endpoint, or at a sentence end once the held text is a real line (>= 1.5 s), or at maxSpanS. Without the
    // sentence rule (and the short host cap) a host mic under nonstop crosstalk held captions for 8-12 s; without
    // the 1.5 s floor "Fine by me." / "Less cooking for once." split again.
    const sentenceEnd = /[.?!]["')\]]?$/.test(last?.punctuated_word ?? '');
    // A question mark flushes at once: the listener's amber "asked you" moment must not wait for speech_final.
    const question = /\?["')\]]?$/.test(last?.punctuated_word ?? '');
    if (r.speech_final || question || (sentenceEnd && span >= 1.5) || span > this.maxSpanS || this.held.length > 60) { this.flush(); return; }
    if (words.length) this.out(this.held, false);
    if (this.held.length) this.arm();
  }
  private arm(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), HOLD_MAX_MS);
    this.timer.unref();
  }
  flush(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
    if (!this.held.length) return;
    const w = this.held; this.held = [];
    this.out(w, true);
  }
}

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
      const jroom = join.room;
      const participant = join.role === 'participant' ? jroom.addParticipant(client, join.name) : null;
      if (!participant) join.room.addHost(client);
      let dgOpenedAt = Date.now();
      const direct = (m: AsrMessage) => {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(m));
      };
      // Participant transcripts go to the room's host(s), never back to the phone.
      const send = (m: AsrMessage) => {
        if (participant && m.type === 'transcript') { join.room.fromParticipant(participant, m, dgOpenedAt); return; }
        // Phones on the table: the host device sits in front of the listener, so its mic is THEIR mic.
        // Attribute host transcripts to ME (-2, named) instead of diarization ids; the client's duplicate guard
        // drops the bleed from other people's phones.
        if (m.type === 'transcript' && join.room.parts.size > 0 && join.room.meName.trim()) {
          direct({ ...m, speaker: -2 }); // no `name`: the client keeps its host-path duplicate guard for these lines
          return;
        }
        direct(m);
      };

      const key = process.env.DEEPGRAM_API_KEY;
      if (!key) {
        send({ type: 'status', state: 'error', detail: 'no DEEPGRAM_API_KEY' });
        client.close(1011, 'no DEEPGRAM_API_KEY');
        if (participant) join.room.removeParticipant(client); else join.room.removeHost(client);
        return;
      }

      const pending: Buffer[] = [];
      let closed = false;
      let dg: WebSocket | null = null;
      let dgFails = 0;
      let lastAudioAt = 0;
      let keepAlive: NodeJS.Timeout | undefined;
      let reconnectTimer: NodeJS.Timeout | undefined;
      const vad = new Vad();
      const co = new Coalescer(send, participant ? 8 : 3);

      // WS heartbeat: a phone that vanished (Wi-Fi drop, killed tab) often never sends a close frame.
      let alive = true;
      client.on('pong', () => { alive = true; });
      const ping = setInterval(() => {
        if (!alive) { req.log.warn({ participant: participant?.name ?? 'host' }, 'ws heartbeat lost; terminating'); client.terminate(); return; }
        alive = false;
        try { client.ping(); } catch { /* closed */ }
      }, PING_MS);
      ping.unref();

      const closeDg = (d: WebSocket | null) => {
        if (!d) return;
        d.removeAllListeners('close'); d.removeAllListeners('error'); d.removeAllListeners('unexpected-response');
        d.on('error', () => { /* ignore late errors */ });
        try {
          if (d.readyState === WebSocket.OPEN) {
            d.send(JSON.stringify({ type: 'CloseStream' }));
            setTimeout(() => d.terminate(), 3000).unref(); // let Deepgram flush the last words first
          } else if (d.readyState === WebSocket.CONNECTING) d.terminate();
        } catch { /* ignore */ }
      };

      const shutdown = (why: string) => {
        if (closed) return;
        closed = true;
        if (participant) join.room.removeParticipant(client);
        else join.room.removeHost(client);
        clearInterval(ping);
        if (keepAlive) clearInterval(keepAlive);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        // Messages still arriving on the closing Deepgram stream (the tail of a sentence) keep flowing to hosts;
        // the coalescer is flushed when that stream closes.
        const d = dg;
        closeDg(d);
        if (d) d.once('close', () => co.flush());
        setTimeout(() => co.flush(), 3500).unref();
        send({ type: 'status', state: 'closed', detail: why });
        if (client.readyState === WebSocket.OPEN) client.close(1000, why.slice(0, 100));
      };

      /** Deepgram dropped while the phone is still connected: reconnect with backoff instead of hanging up on the phone. */
      const dgLost = (why: string, fatal = false) => {
        co.flush(); // don't lose a half-finished sentence
        if (keepAlive) { clearInterval(keepAlive); keepAlive = undefined; }
        const old = dg; dg = null; closeDg(old);
        if (closed) return;
        if (fatal || dgFails >= DG_RECONNECTS) {
          send({ type: 'status', state: 'error', detail: `deepgram: ${why}` });
          shutdown(`deepgram ${why}`);
          return;
        }
        const wait = DG_BACKOFF_MS[Math.min(dgFails, DG_BACKOFF_MS.length - 1)];
        dgFails++;
        req.log.warn({ why, attempt: dgFails, participant: participant?.name ?? 'host' }, 'deepgram lost; reconnecting');
        send({ type: 'status', state: 'connecting', detail: `deepgram reconnect ${dgFails}/${DG_RECONNECTS}` });
        reconnectTimer = setTimeout(connectDg, wait);
      };

      function connectDg() {
        if (closed) return;
        const d = new WebSocket(`${participant ? DG_URL_SOLO : DG_URL}&language=${jroom.lang}`, { headers: { Authorization: `Token ${key}` } });
        dg = d;
        let openedAt = 0;
        // Under nonstop crosstalk + room noise Deepgram never endpoints and held the host mic's is_final for ~10 s
        // (measured). Ask it to finalize once words have been interim-only for too long.
        let lastFinalAt = Date.now();
        const unfinalCapMs = participant ? 8_000 : 4_000;
        d.on('open', () => {
          if (closed || dg !== d) { closeDg(d); return; }
          openedAt = dgOpenedAt = lastFinalAt = Date.now();
          if (!participant) jroom.hostEpoch = dgOpenedAt;
          send({ type: 'status', state: 'open' });
          for (const b of pending.splice(0)) d.send(b);
          keepAlive = setInterval(() => {
            if (d.readyState === WebSocket.OPEN && Date.now() - lastAudioAt > KEEPALIVE_MS) d.send(JSON.stringify({ type: 'KeepAlive' }));
          }, KEEPALIVE_MS);
        });
        d.on('message', (data, isBinary) => {
          if (isBinary) return;
          let msg: { type?: string };
          try { msg = JSON.parse(data.toString()) as { type?: string }; } catch { return; }
          if (msg.type === 'Results') {
            const r = msg as DgResults;
            const now = Date.now();
            if (r.is_final) lastFinalAt = now;
            else if (now - lastFinalAt > unfinalCapMs && (r.channel?.alternatives?.[0]?.words?.length ?? 0) > 0) {
              lastFinalAt = now;
              try { d.send(JSON.stringify({ type: 'Finalize' })); } catch { /* closing */ }
            }
            co.results(r);
          }
          else if (msg.type === 'UtteranceEnd') co.flush();
        });
        d.on('unexpected-response', (_r, res) => {
          const code = res.statusCode ?? 0;
          // 401/403 (bad key), 400 (bad params) won't fix themselves; 429/5xx might.
          dgLost(`HTTP ${code || '?'}`, code === 400 || code === 401 || code === 403);
        });
        d.on('error', (err) => { req.log.warn({ err }, 'deepgram ws error'); dgLost(err.message); });
        d.on('close', (code, reason) => {
          if (openedAt && Date.now() - openedAt > 10_000) dgFails = 0; // it ran fine for a while: fresh retry budget
          dgLost(`closed ${code} ${reason.toString()}`.trim());
        });
      }

      send({ type: 'status', state: 'connecting' });
      connectDg();

      client.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
        if (!isBinary) {
          try {
            const m = JSON.parse(data.toString()) as { type?: string };
            if (m.type === 'stop') shutdown('client stop');
          } catch { /* ignore */ }
          return;
        }
        const buf = Array.isArray(data) ? Buffer.concat(data) : Buffer.isBuffer(data) ? data : Buffer.from(data);
        lastAudioAt = Date.now();
        if (vad.isVoice(buf)) {
          const ms = buf.length / 32; // PCM16 @ 16 kHz: 32 bytes per ms
          if (participant) { join.room.touch(participant); join.room.voice(participant.id, ms); }
          else join.room.hostVoice(ms);
        }
        if (dg?.readyState === WebSocket.OPEN) dg.send(buf);
        else {
          pending.push(buf);
          if (pending.length > MAX_PENDING) pending.shift();
        }
      });
      client.on('close', () => shutdown('client closed'));
      client.on('error', () => shutdown('client error'));
    });
  });
}
