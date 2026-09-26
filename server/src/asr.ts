// ASR bridge: browser PCM16 (16kHz mono) over /ws/audio -> Deepgram streaming -> AsrMessage JSON back.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import WebSocket from 'ws';
import { appendFileSync } from 'node:fs';
import type { AsrMessage } from '../../shared/types';
import { parseJoin, Vad } from './rooms';
import { clearTable } from './voiceid.ts';
import { voiceOf, VoiceTrack } from './voicetrack.ts';

/** DG_DUMP=<path>: append every raw Deepgram Results/UtteranceEnd as JSONL (offline coalescer tuning). */
const DG_DUMP = process.env.DG_DUMP?.trim();

const DG_URL =
  'wss://api.deepgram.com/v1/listen?model=nova-3&diarize=true&smart_format=true&interim_results=true' +
  '&utterance_end_ms=1000&vad_events=true&encoding=linear16&sample_rate=16000&channels=1' +
  // Default endpointing is 10 ms, which finalized at every comma: 41 finals for 23 scripted lines ("Okay." "Focus."
  // "Who's bringing dessert?"), one /api/gate call each. 500 ms + the fragment coalescing below keeps a turn together.
  '&endpointing=400';
// Participant phones: one voice per stream, so no diarization.
const DG_URL_SOLO = DG_URL.replace('diarize=true', 'diarize=false');

/** Nova-3 keyterm prompting (per connection): the listener's name, the table's names, proper nouns from the ledger. */
export function dgUrl(solo: boolean, lang: string, keyterms: string[]): string {
  return `${solo ? DG_URL_SOLO : DG_URL}&language=${lang}` + keyterms.map((k) => `&keyterm=${encodeURIComponent(k)}`).join('');
}
/** Re-open a live Deepgram stream only when this many keyterms are new to it (reconnects cost ~300 ms of setup). */
const KEYTERM_SWAP_MIN_NEW = 3;
const SWAP_SILENCE_MS = 1_000;

interface DgWord {
  word: string; punctuated_word?: string; start: number; end: number; speaker?: number; confidence?: number;
  /** ours, not Deepgram's: PcmRing position (s) of the t=0 of the Deepgram stream that produced this word */
  gBase?: number;
  /** ours: generation of that Deepgram stream (diarization ids restart per stream) */
  gen?: number;
}
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
/** Split a held final at a sentence end followed by >= this much measured silence. Deepgram stretches each word's end to
 *  the next word's start, so its timestamps show NO gap even across a 1 s pause ("it.@11.43-11.91 We@11.91"): the
 *  silence has to come from our own per-chunk VAD on the same stream. */
export const SPLIT_SILENCE_MS = Number(process.env.SPLIT_SILENCE_MS) || 400;

/** Longest run of unvoiced audio (ms) inside [fromS, toS] of the current Deepgram stream's clock. */
export type SilenceFn = (fromS: number, toS: number) => number;

/** Per-stream VAD silence runs on the Deepgram clock (ms of audio actually sent to that stream). */
export class SilenceTrack {
  private sentMs = 0;
  private runStart = -1;
  private runs: { s: number; e: number }[] = [];
  reset(): void { this.sentMs = 0; this.runStart = -1; this.runs = []; }
  /** One chunk delivered to Deepgram. */
  push(ms: number, voiced: boolean): void {
    if (!voiced && this.runStart < 0) this.runStart = this.sentMs;
    if (voiced && this.runStart >= 0) { this.runs.push({ s: this.runStart, e: this.sentMs }); this.runStart = -1; }
    this.sentMs += ms;
    if (this.runs.length > 400) this.runs.splice(0, this.runs.length - 400);
  }
  longest: SilenceFn = (fromS, toS) => {
    const a = fromS * 1000, b = toS * 1000;
    let best = 0;
    const open = this.runStart >= 0 ? [{ s: this.runStart, e: this.sentMs }] : [];
    for (const r of [...this.runs, ...open]) {
      if (r.e <= a || r.s >= b) continue;
      best = Math.max(best, Math.min(r.e, b) - Math.max(r.s, a));
    }
    return best;
  };
}

/** Every Deepgram stream in this process gets its own generation: diarization ids are only meaningful within one. */
let dgStreamSeq = 0;

/**
 * Deepgram sends is_final fragments inside one turn and speech_final at the endpoint. Hold fragments and emit ONE
 * final per turn (speech_final / UtteranceEnd / timeout / stream end); meanwhile show held+new words as an interim
 * so the caption never goes backwards.
 */
export class Coalescer {
  private held: DgWord[] = [];
  private timer: NodeJS.Timeout | undefined;
  /** maxSpanS: hard cap on a held turn. The host mic hears nonstop crosstalk (no endpoint for a long time), so it
   *  uses a short cap; a phone hears one person and can hold a whole turn.
   *  sentenceFloorS: a sentence end flushes early only once the held run spans this long. A phone waits longer (2.5 s):
   *  at 1.5 s "Alright. Sunday, 1:00." flushed and "Sides and dessert sorted." became its own line.
   *  silence: VAD silence lookup for the punctuation-aware split (see SPLIT_SILENCE_MS). */
  /** voiceSplit: cut a word run where the VOICE changes (single-phone mode, voicetrack.ts); interims and finals alike. */
  constructor(private emit: (m: AsrMessage, src?: { gBase: number; gen: number }) => void, private maxSpanS = 8, private sentenceFloorS = 1.5, private silence?: SilenceFn,
    private voiceSplit?: (words: DgWord[]) => DgWord[][], private onVoiceSplit?: (n: number) => void) {}
  private out(words: DgWord[], final: boolean) {
    const byVoice = this.voiceSplit ? this.voiceSplit(words) : [words];
    for (const seg of byVoice.flatMap((v) => (final ? this.splitAtPauses(v) : [v]))) {
      const src = seg[0]?.gBase != null ? { gBase: seg[0].gBase, gen: seg[0].gen ?? 0 } : undefined;
      for (const m of resultsToMessages({ type: 'Results', is_final: final, channel: { alternatives: [{ words: seg }] } })) this.emit(m, src);
    }
  }
  /** Split at a sentence end (.?!) followed by >= SPLIT_SILENCE_MS of measured silence before the next word. */
  splitAtPauses(words: DgWord[]): DgWord[][] {
    if (!this.silence || words.length < 2) return [words];
    const out: DgWord[][] = [];
    let cur: DgWord[] = [];
    for (let i = 0; i < words.length; i++) {
      cur.push(words[i]);
      const next = words[i + 1];
      if (!next || !/[.?!]["')\]]?$/.test(words[i].punctuated_word ?? '')) continue;
      // The pause hides inside the stretched end of the sentence-final word: look from its start to the next word's start.
      if (this.silence(words[i].start, next.start + 0.05) >= SPLIT_SILENCE_MS) { out.push(cur); cur = []; }
    }
    if (cur.length) out.push(cur);
    return out;
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
    // Someone else's voice took over mid-run: the part before the change is a finished line NOW (old speaker's name).
    if (this.voiceSplit && this.held.length > 1) {
      const parts = this.voiceSplit(this.held);
      if (parts.length > 1) {
        this.onVoiceSplit?.(parts.length - 1);
        for (const p of parts.slice(0, -1)) this.out(p, true);
        this.held = parts[parts.length - 1];
      }
    }
    const last = this.held[this.held.length - 1];
    const span = this.held.length ? last.end - this.held[0].start : 0;
    // Flush at the endpoint, or at a sentence end once the held text is a real line (>= 1.5 s), or at maxSpanS. Without the
    // sentence rule (and the short host cap) a host mic under nonstop crosstalk held captions for 8-12 s; without
    // the 1.5 s floor "Fine by me." / "Less cooking for once." split again.
    const sentenceEnd = /[.?!]["')\]]?$/.test(last?.punctuated_word ?? '');
    // A question mark flushes at once: the listener's amber "asked you" moment must not wait for speech_final.
    const question = /\?["')\]]?$/.test(last?.punctuated_word ?? '');
    if (r.speech_final || question || (sentenceEnd && span >= this.sentenceFloorS) || span > this.maxSpanS || this.held.length > 60) { this.flush(); return; }
    if (words.length) this.out(this.held, false);
    if (this.held.length) this.arm();
  }
  private arm(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), HOLD_MAX_MS);
    this.timer.unref();
  }
  /** True while is_final words are held (mid-turn): not a safe moment to swap Deepgram streams. */
  get holding(): boolean { return this.held.length > 0; }
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
      // Voice id (single-phone mode, voicetrack.ts): the PCM this socket sent to Deepgram on one clock across Deepgram
      // streams; on the host mic also sliding-window names (interims) and voice-change splits. Sync: ordering is kept.
      const voice = new VoiceTrack(jroom.token, !participant, jroom.voiceStats);
      // Participant transcripts go to the room's host(s), never back to the phone.
      const send = (m: AsrMessage, src?: { gBase: number; gen: number }) => {
        if (participant && m.type === 'transcript') {
          const slice = voice.slicer(src?.gBase);
          join.room.fromParticipant(participant, m, dgOpenedAt, (t0, t1) => voiceOf(jroom.token, slice, t0, t1, true));
          return;
        }
        // Phones on the table: the host device sits in front of the listener, so its mic is THEIR mic.
        // Attribute host transcripts to ME (-2, named) instead of diarization ids; the client's duplicate guard
        // drops the bleed from other people's phones.
        if (m.type === 'transcript' && join.room.participantCount > 0 && join.room.meName.trim()) {
          // no `name`: the client keeps its host-path duplicate guard for these lines
          join.room.fromHost({ ...m, speaker: -2 }, dgOpenedAt, direct);
          return;
        }
        if (m.type === 'transcript') m = voice.stamp(m, src);
        if (m.type === 'transcript' && m.final) { join.room.fromHost(m, dgOpenedAt, direct); return; }
        direct(m);
      };

      const key = process.env.DEEPGRAM_API_KEY;
      if (!key) {
        send({ type: 'status', state: 'error', detail: 'no DEEPGRAM_API_KEY' });
        client.close(1011, 'no DEEPGRAM_API_KEY');
        if (participant) join.room.removeParticipant(client); else join.room.removeHost(client);
        return;
      }

      const pending: { b: Buffer; v: boolean; at: number }[] = [];
      // Deepgram's t=0 is the START of the first chunk that stream received, not the moment it opened: with pending audio
      // flushed at open that was ~0.1-0.8 s off, which misaligned words vs our per-chunk levels (bleed filter) and prosody.
      let needEpoch = false;
      const setEpoch = (t: number) => { dgOpenedAt = t; if (!participant) jroom.hostEpoch = t; needEpoch = false; };
      const sil = new SilenceTrack();
      let closed = false;
      let dg: WebSocket | null = null;
      let dgFails = 0;
      let lastAudioAt = 0;
      let keepAlive: NodeJS.Timeout | undefined;
      let reconnectTimer: NodeJS.Timeout | undefined;
      const vad = new Vad();
      voice.silence = sil.longest;
      const co = participant
        ? new Coalescer(send, 8, 2.5, sil.longest)
        : new Coalescer(send, 3, 1.5, sil.longest, (w) => voice.split(w), (n) => voice.countSplit(n));
      // Keyterms: applied on connect; when the room's set gains >= 3 terms this stream doesn't have, re-open Deepgram at
      // the next >= 1 s of silence (no held words, no voiced audio, no words from Deepgram) and swap streams seamlessly.
      let dgTerms: string[] = [];
      let wantSwap = false;
      let swapDg: WebSocket | null = null;
      let lastVoiceAt = 0, lastWordsAt = 0;
      const offTerms = jroom.onTerms(() => {
        const have = new Set(dgTerms.map((t) => t.toLowerCase()));
        const fresh = jroom.keyterms().filter((t) => !have.has(t.toLowerCase())).length;
        if (fresh >= KEYTERM_SWAP_MIN_NEW) wantSwap = true;
      });
      const maybeSwap = () => {
        if (!wantSwap || swapDg || closed || dg?.readyState !== WebSocket.OPEN) return;
        const now = Date.now();
        if (co.holding || now - lastVoiceAt < SWAP_SILENCE_MS || now - lastWordsAt < SWAP_SILENCE_MS) return;
        wantSwap = false;
        req.log.info({ participant: participant?.name ?? 'host', keyterms: jroom.keyterms() }, 'deepgram keyterms changed; swapping stream');
        connectDg(true);
      };

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
        else {
          join.room.removeHost(client);
          // Last listener gone: forget the table's voices (after a grace, so a mic restart / Wi-Fi blip keeps them).
          jroom.whenNoHosts(() => clearTable(jroom.token));
        }
        clearInterval(ping);
        offTerms();
        if (keepAlive) clearInterval(keepAlive);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (swapDg) { closeDg(swapDg); swapDg = null; }
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
        reconnectTimer = setTimeout(() => connectDg(), wait);
      };

      /** swap=true: open a second stream with fresh keyterms while the current one keeps running; switch on open. */
      function connectDg(swap = false) {
        if (closed) return;
        const terms = jroom.keyterms();
        const d = new WebSocket(dgUrl(!!participant, jroom.lang, terms), { headers: { Authorization: `Token ${key}` } });
        if (swap) swapDg = d; else dg = d;
        let openedAt = 0;
        let myBase = 0, myGen = 0; // this stream's t=0 on the voice ring, and its generation (set on open)
        const who = participant?.name ?? 'host';
        /** A failed swap attempt just goes away: the old stream is still live. */
        const abandonSwap = (why: string) => {
          if (swapDg !== d) return false;
          swapDg = null; closeDg(d);
          req.log.warn({ why, participant: who }, 'deepgram keyterm swap failed; keeping the old stream');
          return true;
        };
        // Under nonstop crosstalk + room noise Deepgram never endpoints and held the host mic's is_final for ~10 s
        // (measured). Ask it to finalize once words have been interim-only for too long.
        let lastFinalAt = Date.now();
        const unfinalCapMs = participant ? 8_000 : 4_000;
        d.on('open', () => {
          if (swapDg === d && !closed) {
            // Swap: the old stream gets CloseStream (its last words still flow through the shared coalescer).
            const old = dg; swapDg = null; dg = d;
            if (keepAlive) { clearInterval(keepAlive); keepAlive = undefined; }
            closeDg(old);
          }
          if (closed || dg !== d) { closeDg(d); return; }
          dgTerms = terms; wantSwap = false;
          openedAt = dgOpenedAt = lastFinalAt = Date.now();
          if (!participant) jroom.hostEpoch = dgOpenedAt;
          send({ type: 'status', state: 'open' });
          sil.reset();
          myGen = ++dgStreamSeq; voice.newStream(myGen); myBase = voice.base;
          if (pending.length) setEpoch(pending[0].at - pending[0].b.length / 32); else needEpoch = true;
          for (const p of pending.splice(0)) { d.send(p.b); sil.push(p.b.length / 32, p.v); voice.push(p.b, p.v); }
          keepAlive = setInterval(() => {
            if (d.readyState === WebSocket.OPEN && Date.now() - lastAudioAt > KEEPALIVE_MS) d.send(JSON.stringify({ type: 'KeepAlive' }));
          }, KEEPALIVE_MS);
        });
        d.on('message', (data, isBinary) => {
          if (isBinary) return;
          let msg: { type?: string };
          try { msg = JSON.parse(data.toString()) as { type?: string }; } catch { return; }
          if (DG_DUMP) { try { appendFileSync(DG_DUMP, JSON.stringify({ who, at: Date.now(), msg }) + '\n'); } catch { /* ignore */ } }
          if (msg.type === 'Results') {
            const r = msg as DgResults;
            const now = Date.now();
            if (r.channel?.alternatives?.[0]?.words?.length) lastWordsAt = now;
            if (r.is_final) lastFinalAt = now;
            else if (now - lastFinalAt > unfinalCapMs && (r.channel?.alternatives?.[0]?.words?.length ?? 0) > 0) {
              lastFinalAt = now;
              try { d.send(JSON.stringify({ type: 'Finalize' })); } catch { /* closing */ }
            }
            for (const w of r.channel?.alternatives?.[0]?.words ?? []) { w.gBase = myBase; w.gen = myGen; }
            co.results(r);
          }
          else if (msg.type === 'UtteranceEnd') co.flush();
        });
        d.on('unexpected-response', (_r, res) => {
          const code = res.statusCode ?? 0;
          if (abandonSwap(`HTTP ${code}`)) return;
          // 401/403 (bad key), 400 (bad params) won't fix themselves; 429/5xx might.
          dgLost(`HTTP ${code || '?'}`, code === 400 || code === 401 || code === 403);
        });
        d.on('error', (err) => { req.log.warn({ err }, 'deepgram ws error'); if (!abandonSwap(err.message)) dgLost(err.message); });
        d.on('close', (code, reason) => {
          if (abandonSwap(`closed ${code}`)) return;
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
        const voiced = vad.isVoice(buf);
        join.room.level(participant ? participant.id : 'host', vad.lastRms, voiced);
        if (voiced) {
          const ms = buf.length / 32; // PCM16 @ 16 kHz: 32 bytes per ms
          lastVoiceAt = lastAudioAt;
          if (participant) { join.room.touch(participant); join.room.voice(participant.id, ms, vad.lastRms); }
          else join.room.hostVoice(ms);
        }
        maybeSwap();
        if (dg?.readyState === WebSocket.OPEN) {
          if (needEpoch) setEpoch(lastAudioAt - buf.length / 32);
          dg.send(buf); sil.push(buf.length / 32, voiced); voice.push(buf, voiced);
        } else {
          pending.push({ b: buf, v: voiced, at: lastAudioAt });
          if (pending.length > MAX_PENDING) pending.shift();
        }
      });
      client.on('close', () => shutdown('client closed'));
      client.on('error', () => shutdown('client error'));
    });
  });
}
