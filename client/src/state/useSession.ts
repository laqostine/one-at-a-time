// Wires audio/replay sources -> reducer, runs the ledger loop, exposes catch-up.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { AsrMessage, CatchupResponse, EventKind, Participant, Session, StateMood } from '../../../shared/types';
import { startMic, type MicHandle } from '../audio/mic';
import { startEvents } from '../audio/events';
import { startWebSpeech } from '../audio/webspeech';
import { startReplay } from '../replay/replay';
import { postCatchup, postState } from './api';
import { initSession, isUtt, lastMinutes, sessionReducer, speakerName, utterancesByThread, windowSince, type SessionState } from './session';
import { matchThread } from '../../../shared/threads';
import { isAddressedToMe } from './addressed';
import { useGate } from './useGate';
import type { Utterance } from '../../../shared/types';

export type AsrState = 'idle' | 'connecting' | 'open' | 'closed' | 'error' | 'paused';
export type Source = 'mic' | 'webspeech' | 'replay';
export interface Nudge { id: string; speaker: string; speakerId?: number; question: string; t: number }
export type CatchupState =
  | { status: 'idle' }
  | { status: 'loading'; startedAt: number }
  | { status: 'ready'; data: CatchupResponse; at: number; latencyMs: number }
  | { status: 'error'; message: string; at: number };

const STATE_EVERY_MS = 8_000;
const AI_MOOD_FRESH_MS = 20_000; // the /api/state mood is shown only while this fresh; after that the UI falls back to lib/mood
const MOOD_POST_MIN_MS = 3_000;
const CATCHUP_MIN_MS = 60_000;
const CATCHUP_MAX_MS = 5 * 60_000;
// Double-caption guard: the host mic also hears people talking into their phones.
const DUP_WINDOW_MS = 2_500;
const DUP_OVERLAP = 0.6;
const DUP_KEEP_MS = 15_000;
const dupTokens = (t: string) => new Set(t.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').split(/\s+/).filter(Boolean));
/** Fraction of the host line's tokens that also appear in the participant line. */
function dupOverlap(host: Set<string>, part: Set<string>): number {
  if (!host.size) return 0;
  let n = 0;
  for (const w of host) if (part.has(w)) n++;
  return n / host.size;
}
type TranscriptMsg = Extract<AsrMessage, { type: 'transcript' }>;
/** Client speaker ids for voice-named people (Deepgram ids are 0..n, phones 100+). */
const VOICE_ID_BASE = 300;

/** Sources may return {stop}, a stop fn, a promise of either, or nothing — normalize. */
type Stopper = () => void;
async function toStopper(x: unknown): Promise<Stopper> {
  const v = await Promise.resolve(x);
  if (typeof v === 'function') return v as Stopper;
  if (v && typeof (v as { stop?: unknown }).stop === 'function') return () => (v as { stop: Stopper }).stop();
  return () => {};
}

// Capitalised words that are names, not sentence starts or everyday words ("Friday launch" -> no; "Joyce's pie" -> Joyce).
const NOT_NAMES = new Set(('I I\'m I\'ll I\'d I\'ve OK Okay Yes No The A An And But Or So If We You He She They It This That These Those ' +
  'Who What When Where Why How Monday Tuesday Wednesday Thursday Friday Saturday Sunday Today Tomorrow Tonight Mom Dad ' +
  'January February March April May June July August September October November December Thanksgiving Christmas').split(' ').map((w) => w.toLowerCase()));
/** Up to 10 distinct proper nouns from short texts, most recent text first. */
export function properNouns(texts: string[], meName = ''): string[] {
  const out: string[] = []; const seen = new Set<string>([meName.trim().toLowerCase()]);
  for (const t of [...texts].reverse()) {
    const words = t.split(/\s+/);
    words.forEach((raw, i) => {
      const bare = raw.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
      const w = bare.replace(/['’]s$/u, '');
      const prev = words[i - 1] ?? '';
      // Sentence start is capitalised anyway: only a possessive ("Joyce's pie") counts there.
      if ((i === 0 || /[.?!:]$/.test(prev)) && w === bare) return;
      if (!/^\p{Lu}\p{Ll}{1,}$/u.test(w) || NOT_NAMES.has(w.toLowerCase()) || seen.has(w.toLowerCase())) return;
      seen.add(w.toLowerCase());
      if (out.length < 10) out.push(w);
    });
  }
  return out;
}

function replayName(): string | null {
  try { return new URLSearchParams(window.location.search).get('replay'); } catch { return null; }
}

function loadMe(): Session['me'] {
  // Stage shortcut: /?me=Ayse sets (and saves) the listener's name so a judge can be handed the phone in one tap.
  try {
    const q = new URLSearchParams(window.location.search).get('me');
    if (q && q.trim()) {
      const me = { name: q.trim().slice(0, 40), aliases: [] as string[] };
      try { localStorage.setItem('imt.me', JSON.stringify(me)); } catch { /* ignore */ }
      return me;
    }
  } catch { /* no window */ }
  try {
    const raw = localStorage.getItem('imt.me');
    if (raw) { const v = JSON.parse(raw); if (typeof v?.name === 'string') return { name: v.name, aliases: Array.isArray(v.aliases) ? v.aliases : [] }; }
  } catch { /* storage unavailable */ }
  return { name: '', aliases: [] };
}

export function useSession() {
  const [session, dispatch] = useReducer(sessionReducer, undefined, () => initSession(loadMe()));
  const ref = useRef<SessionState>(session);
  ref.current = session;

  const [listening, setListening] = useState(true);
  // Click gate: browsers keep AudioContext suspended without a user gesture, so the live mic
  // only starts after "Start listening" (or onboarding submit). Replay needs no mic: auto-start.
  const [started, setStarted] = useState(() => !!replayName());
  // Table-wide pace/overlap from the server (only while phones are joined).
  const [table, setTable] = useState<{ overlap: boolean; avgWpm: number } | null>(null);
  const [laughAt, setLaughAt] = useState(0); // wall-clock ms of the last host `laugh` message
  // "Use phones only": null = user hasn't chosen => ON by default once a phone joins.
  const [phonesOnlyPref, setPhonesOnlyPref] = useState<boolean | null>(null);
  const micRef = useRef<MicHandle | null>(null);
  const hostMutedRef = useRef(false);
  const participantsRef = useRef<Participant[]>([]);
  const partFinals = useRef<{ at: number; tokens: Set<string> }[]>([]);
  /** Union of phone-final tokens that arrived in [from, to] (wall clock). The host mic merges 2-3 phone lines into
   *  one final during crosstalk, so matching against any single phone line missed half the duplicates (9 of 18). */
  const phoneTokensIn = (from: number, to: number) => {
    const u = new Set<string>();
    for (const f of partFinals.current) if (f.at >= from && f.at <= to) for (const w of f.tokens) u.add(w);
    return u;
  };
  const heldHost = useRef(new Map<string, { msg: TranscriptMsg; tokens: Set<string>; timer: number; at: number }>());
  const [asr, setAsr] = useState<{ state: AsrState; detail?: string; source: Source }>({
    state: 'idle', source: replayName() ? 'replay' : 'mic',
  });
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [catchup, setCatchup] = useState<CatchupState>({ status: 'idle' });
  const [latency, setLatency] = useState<{ stateMs?: number; catchupMs?: number; stateError?: string }>({});
  // AI-judged mood from /api/state (tones + voice cues of the last ~60 s). `mood` below is null once it is > 20 s old.
  const [aiMood, setAiMood] = useState<(StateMood & { at: number }) | null>(null);
  const moodPost = useRef({ at: 0, timer: 0 });
  // "Everyone joins": phones connected to this table (from the server's `participants` message)
  const [participants, setParticipants] = useState<Participant[]>([]);
  // Presence indicator inputs: when a transcript (interim or final) last arrived, whether a
  // /api/state or /api/catchup request is in flight, and the mic's smoothed RMS level (0..1).
  const [lastTranscriptAt, setLastTranscriptAt] = useState(0);
  const [requestPending, setRequestPending] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const micFrameCount = useRef(0);

  const nowT = useCallback(() => Date.now() - ref.current.startedAt, []);
  const dirty = useRef(false);
  const nudgedIds = useRef(new Set<string>());

  const fireNudge = useCallback((n: Nudge) => {
    if (nudgedIds.current.has(n.id)) return;
    nudgedIds.current.add(n.id);
    setNudge(n);
    try { navigator.vibrate?.(200); } catch { /* unsupported */ }
  }, []);

  // ---- fast decision gate (/api/gate): upgrades the regex nudge + provisional ledger cards ----
  const coveredT = useRef(-1);
  const nudgeUtt = useCallback((utt: Utterance, speaker: string) => {
    dispatch({ type: 'markAddressed', id: utt.id });
    fireNudge({ id: utt.id, speaker, speakerId: utt.speaker, question: utt.text.trim(), t: utt.tStart });
  }, [fireNudge]);
  const getSession = useCallback(() => ref.current, []);
  const { gateUtterance, gateLatencyMs, lastGate } = useGate({ getSession, dispatch, nudge: nudgeUtt, coveredT });

  // Single-phone voice id: enrolled name -> the client speaker id that shows it (one id, one color per name).
  const voiceIds = useRef(new Map<string, number>());
  const UNKNOWN_VOICE = 'Someone';
  const interimOwner = useRef(new Map<string, number>()); // `${dg speaker}:${raw tStart}` -> client speaker of its interim
  /** Host line stamped with `voiceName`: route it to that name's speaker. First sighting names the Deepgram id's own
   *  speaker (if still unnamed) or gets a fresh id; a second Deepgram id for a known name is merged into it. */
  const voiceSpeaker = useCallback((raw: TranscriptMsg): number => {
    const name = raw.voiceName?.trim() || (voiceIds.current.size ? UNKNOWN_VOICE : '');
    if (!name) return raw.speaker;
    const s = ref.current;
    const canon = (id: number) => (id >= 0 ? (s.merged[id] ?? id) : id);
    const key = name.toLowerCase();
    const claimed = new Set([...voiceIds.current.values()].map(canon));
    const own = canon(raw.speaker);
    const known = voiceIds.current.get(key);
    if (known != null) {
      const to = canon(known);
      // Another Deepgram id for the same person, still unnamed and nobody's voice: fold it in (its interims too).
      if (own >= 0 && own !== to && !claimed.has(own) && !s.speakers[own]?.name && s.speakers[to]) dispatch({ type: 'mergeSpeaker', from: own, to });
      return to;
    }
    let id: number;
    const ownName = own >= 0 ? s.speakers[own]?.name?.trim().toLowerCase() : undefined;
    if (own >= 0 && !claimed.has(own) && (!ownName || ownName === key)) id = own;
    else {
      // A named speaker with the same name (typed by the user) wins; else a fresh id outside Deepgram/phone ranges.
      const same = Object.values(s.speakers).find((sp) => sp.name?.trim().toLowerCase() === key && !claimed.has(canon(sp.id)));
      id = same ? canon(same.id) : VOICE_ID_BASE + voiceIds.current.size;
    }
    voiceIds.current.set(key, id);
    dispatch({ type: 'seedSpeakers', names: { [id]: name } });
    return id;
  }, []);

  // ASR times are ms since the *stream* start (reset on reconnect); shift onto the session clock.
  const offset = useRef<number | null>(null);
  const lastRaw = useRef(0);

  const onMessage = useCallback((raw: AsrMessage) => {
    if (raw.type === 'status') {
      if (raw.state === 'open') offset.current = Date.now() - ref.current.startedAt;
      setAsr((a) => ({ ...a, state: raw.state, detail: raw.detail }));
      return;
    }
    if (raw.type === 'participants') { participantsRef.current = raw.list; setParticipants(raw.list); return; }
    if (raw.type === 'table') { setTable({ overlap: raw.overlap, avgWpm: raw.avgWpm }); return; }
    if (raw.type === 'laugh') { setLaughAt(Date.now()); return; }
    if (raw.type === 'pace') return; // participant-only message
    // Any other non-transcript message kind (pace/overlap telemetry, etc.) isn't handled here yet.
    if (raw.type !== 'transcript') return;
    const now = Date.now() - ref.current.startedAt;
    if (raw.name) {
      // Participant phone line: the server already rebased it onto the host stream clock,
      // so don't let it trip the reconnect heuristic below. Name the speaker immediately.
      if (offset.current == null) offset.current = Math.max(0, now - raw.tEnd);
      if (!ref.current.speakers[raw.speaker]?.name) dispatch({ type: 'seedSpeakers', names: { [raw.speaker]: raw.name } });
    } else {
      if (offset.current == null || raw.tStart < lastRaw.current - 5_000) offset.current = Math.max(0, now - raw.tEnd);
      lastRaw.current = raw.tStart;
    }
    // Host path (no `name`) keeps its duplicate guard below; only the speaker id changes for voice-named lines.
    const speaker = !raw.name && (raw.voiceName || voiceIds.current.size) ? voiceSpeaker(raw) : raw.speaker;
    const msg = { ...raw, speaker, tStart: raw.tStart + offset.current, tEnd: raw.tEnd + offset.current };
    // The server re-named a live interim (the voice windows changed their mind): drop the old name's interim so no
    // ghost line is left under it. Same name = same speaker id = the interim just updates in place (no flicker).
    if (!raw.name && !raw.final) {
      const rk = `${raw.speaker}:${raw.tStart}`;
      const prev = interimOwner.current.get(rk);
      if (prev != null && prev !== speaker) dispatch({ type: 'transcript', msg: { ...msg, speaker: prev, text: '' } });
      interimOwner.current.set(rk, speaker);
      if (interimOwner.current.size > 50) interimOwner.current.delete(interimOwner.current.keys().next().value!);
    }
    // Double-caption guard: drop a host-mic final if a phone final with >=60% of its words arrived within ±2.5 s.
    if (msg.final && msg.text.trim()) {
      const at = Date.now();
      const tokens = dupTokens(msg.text);
      const hostSpan = (m: TranscriptMsg) => Math.max(0, m.tEnd - m.tStart);
      if (raw.name) {
        partFinals.current = partFinals.current.filter((f) => at - f.at <= DUP_KEEP_MS);
        partFinals.current.push({ at, tokens });
        for (const [k, h] of heldHost.current) {
          const heldAt = h.at;
          if (dupOverlap(h.tokens, phoneTokensIn(heldAt - hostSpan(h.msg) - DUP_WINDOW_MS, at)) >= DUP_OVERLAP) {
            window.clearTimeout(h.timer);
            heldHost.current.delete(k);
            dispatch({ type: 'transcript', msg: { ...h.msg, text: '' } }); // clears that speaker's interim
          }
        }
      } else if (participantsRef.current.length > 0 && !hostMutedRef.current) {
        if (dupOverlap(tokens, phoneTokensIn(at - hostSpan(msg) - DUP_WINDOW_MS, at)) >= DUP_OVERLAP) {
          dispatch({ type: 'transcript', msg: { ...msg, text: '' } });
          return;
        }
        // A phone's copy may still be on its way: hold the host line for the window, then commit.
        const k = `${msg.speaker}-${msg.tStart}`;
        const timer = window.setTimeout(() => { heldHost.current.delete(k); commit(msg); }, DUP_WINDOW_MS);
        heldHost.current.set(k, { msg, tokens, timer, at });
        return;
      }
    }
    commit(msg);
  }, [fireNudge, voiceSpeaker]);

  const earlyAsk = useRef<string>(''); // interim text that already fired the nudge, so the final doesn't fire twice
  const commit = useCallback((msg: TranscriptMsg) => {
    dispatch({ type: 'transcript', msg });
    if (msg.text.trim()) setLastTranscriptAt(Date.now());
    // Early ask: interim words already name ME with a question shape -> amber now, ~1-2 s before the final lands.
    if (!msg.final && msg.text.trim()) {
      const me0 = ref.current.me;
      const t = msg.text.trim();
      if (me0.name && t.length > 8 && earlyAsk.current !== `${msg.speaker}-${msg.tStart}` && isAddressedToMe(t, me0)) {
        earlyAsk.current = `${msg.speaker}-${msg.tStart}`;
        const sp = msg.speaker >= 0 ? (ref.current.merged[msg.speaker] ?? msg.speaker) : -1;
        fireNudge({ id: `u${sp}-${msg.tStart}`, speaker: speakerName(ref.current, sp), speakerId: sp, question: t, t: msg.tStart });
      }
      return;
    }
    if (!msg.final || !msg.text.trim()) return;
    dirty.current = true;
    const me = ref.current.me;
    const speaker = msg.speaker >= 0 ? (ref.current.merged[msg.speaker] ?? msg.speaker) : -1;
    const id = `u${speaker}-${msg.tStart}`;
    // Regex first pass stays instant; the gate below can only add nudges, never delay this one.
    if (me.name && isAddressedToMe(msg.text, me)) {
      dispatch({ type: 'markAddressed', id });
      if (earlyAsk.current !== `${msg.speaker}-${msg.tStart}`) {
        fireNudge({ id, speaker: speakerName(ref.current, speaker), speakerId: speaker, question: msg.text.trim(), t: msg.tStart });
      }
      earlyAsk.current = '';
    }
    gateUtterance({ id, type: 'utterance', speaker, text: msg.text.trim(), tStart: msg.tStart, tEnd: msg.tEnd, final: true, ...(msg.prosody ? { prosody: msg.prosody } : {}) });
  }, [fireNudge, gateUtterance]);

  const evSeq = useRef(0);
  const onEvent = useCallback((e: { kind: EventKind; score: number }) => {
    const t = Date.now() - ref.current.startedAt;
    dispatch({ type: 'event', event: { id: `e${t}-${evSeq.current++}`, type: 'event', kind: e.kind, t, score: e.score } });
  }, []);

  // ---- audio / replay source lifecycle ----
  useEffect(() => {
    if (!started) return; // click gate (asr stays 'idle')
    if (!listening) { setAsr((a) => ({ ...a, state: 'paused' })); return; }
    let cancelled = false;
    const stops: Stopper[] = [];
    const add = async (x: unknown) => { const s = await toStopper(x); if (cancelled) s(); else stops.push(s); };
    const name = replayName();

    offset.current = null;
    lastRaw.current = 0;
    const run = async () => {
      if (name) {
        setAsr({ state: 'connecting', source: 'replay' });
        dispatch({ type: 'reset', startedAt: Date.now() });
        fetch(`/replay/${encodeURIComponent(name)}.json`).then((r) => (r.ok ? r.json() : null))
          .then((j) => { if (!cancelled && j?.names) dispatch({ type: 'seedSpeakers', names: j.names }); })
          .catch(() => {});
        const speed = Number(new URLSearchParams(window.location.search).get('speed')) || 1; // ?speed=2 for demos
        await add(startReplay(name, onMessage, onEvent, speed));
        if (!cancelled) setAsr((a) => (a.state === 'connecting' ? { ...a, state: 'open' } : a));
        return;
      }
      let fellBack = false;
      let events: ReturnType<typeof startEvents> | null = null;
      try { events = startEvents(onEvent); await add(events); } catch (e) { console.warn('[events] unavailable', e); }

      const fallback = async (detail?: string) => {
        if (fellBack || cancelled) return;
        fellBack = true;
        console.warn('[asr] falling back to Web Speech:', detail);
        stops.splice(0).forEach((s) => { try { s(); } catch { /* ignore */ } });
        offset.current = null;
        lastRaw.current = 0;
        setAsr({ state: 'connecting', source: 'webspeech', detail: 'Captions only (no speakers)' });
        try {
          await add(startWebSpeech((m: AsrMessage) => {
            if (m.type === 'status') setAsr((a) => ({ ...a, state: m.state, detail: m.detail ?? a.detail }));
            else onMessage(m);
          }));
        } catch (e) {
          setAsr({ state: 'error', source: 'webspeech', detail: String((e as Error)?.message ?? e) });
        }
      };

      setAsr({ state: 'connecting', source: 'mic' });
      try {
        const mic = await startMic(
          (m: AsrMessage) => {
            // e.g. 'no DEEPGRAM_API_KEY', 'deepgram HTTP 401', or reconnects exhausted.
            if (m.type === 'status' && m.state === 'error') { void fallback(m.detail); return; }
            if (!fellBack) onMessage(m);
          },
          (pcm) => {
            try { events?.push(pcm); } catch { /* ignore */ }
            // Cheap RMS level for the Presence indicator: every 4th frame is plenty.
            if (++micFrameCount.current % 4 === 0) {
              let sum = 0;
              for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
              const rms = Math.min(1, Math.sqrt(sum / Math.max(1, pcm.length)) * 6);
              setMicLevel((p) => p * 0.5 + rms * 0.5);
            }
          },
        );
        micRef.current = mic;
        mic.setMuted(hostMutedRef.current);
        await add(mic);
      } catch (e) {
        await fallback(String((e as Error)?.message ?? e));
      }
    };
    void run();
    return () => { cancelled = true; setParticipants([]); stops.splice(0).forEach((s) => { try { s(); } catch { /* ignore */ } }); };
  }, [listening, started, onMessage, onEvent]);

  // ---- phones-only: mute this device's mic while >= 1 phone is joined (default OFF: the listener's own
  // mic stays on and the server attributes it to ME; bleed from other phones is dropped by the dup guard) ----
  const phonesOnly = (phonesOnlyPref ?? false) && participants.length > 0;
  useEffect(() => {
    hostMutedRef.current = phonesOnly;
    micRef.current?.setMuted(phonesOnly);
  }, [phonesOnly]);
  useEffect(() => { if (!participants.length) setTable(null); }, [participants.length]);

  // ---- tell the room our name so phones can say "Good pace for <name>" ----
  const asrOpen = asr.state === 'open';
  const aliasKey = session.me.aliases.join('|');
  useEffect(() => {
    if (!session.me.name || replayName()) return;
    void fetch('/api/room/me', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: session.me.name, aliases: session.me.aliases }) }).catch(() => {});
  }, [session.me.name, aliasKey, asrOpen]);

  // ---- Deepgram keyterms: proper nouns from thread labels + ledger text (the server keeps <= 10 of them) ----
  const termsKey = properNouns([...session.threads.map((t) => t.label), ...session.ledger.map((l) => l.text)], session.me.name).join('|');
  const sentTerms = useRef('');
  useEffect(() => {
    if (replayName() || !termsKey || termsKey === sentTerms.current) return;
    const id = window.setTimeout(() => {
      sentTerms.current = termsKey;
      void fetch('/api/room/terms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ terms: termsKey.split('|') }) }).catch(() => { sentTerms.current = ''; });
    }, 1_500);
    return () => window.clearTimeout(id);
  }, [termsKey]);

  // ---- ledger loop: postState every 8s when new finals arrived ----
  useEffect(() => {
    let inflight = false;
    const id = window.setInterval(async () => {
      if (!dirty.current || inflight || !listening) return;
      dirty.current = false;
      inflight = true;
      setRequestPending(true);
      const s = ref.current;
      const t0 = performance.now();
      try {
        const win = lastMinutes(s, 1.5, nowT()); // 90 s keeps the ledger call ~4 s live; older items persist via `existing`
        const covered = win.reduce((m, i) => (isUtt(i) && i.final ? Math.max(m, i.tStart) : m), -1);
        const res = await postState({ me: s.me, speakers: s.speakers, window: win, nowT: nowT(), existing: s.ledger.filter((i) => !i.provisional), existing_threads: s.threads });
        // Server fallback (model failed/timed out): it only echoes `existing`, so don't let it sweep the gate's
        // provisional cards or advance coveredT; retry on the next tick.
        if (res.degraded) throw new Error('ledger update degraded');
        const ms = Math.round(performance.now() - t0);
        setLatency((l) => ({ ...l, stateMs: res.latencyMs ?? ms, stateError: undefined }));
        coveredT.current = Math.max(coveredT.current, covered);
        dispatch({ type: 'setLedger', items: res.ledger ?? [], coveredT: covered });
        if (res.threads) dispatch({ type: 'applyThreads', threads: res.threads, utteranceThreads: res.utteranceThreads ?? [] });
        const a = res.addressed_to_me_now;
        if (a && ref.current.me.name) fireNudge({ id: `s-${a.t}`, speaker: a.speaker, question: a.question, t: a.t });
        if (res.mood) {
          const m = res.mood;
          setAiMood({ ...m, at: Date.now() });
          // Phones' lamps show the AI's judgement: POST /api/room/mood, at most every 3 s (skip in replay: no room).
          if (!replayName()) {
            const body = JSON.stringify({ table: m.table, speakers: Object.fromEntries(m.speakers.map((sp) => [sp.name, sp.mood])) });
            const send = () => { moodPost.current.at = Date.now(); void fetch('/api/room/mood', { method: 'POST', headers: { 'content-type': 'application/json' }, body }).catch(() => {}); };
            window.clearTimeout(moodPost.current.timer);
            const wait = MOOD_POST_MIN_MS - (Date.now() - moodPost.current.at);
            if (wait <= 0) send(); else moodPost.current.timer = window.setTimeout(send, wait);
          }
        }
      } catch (e) {
        dirty.current = true;
        setLatency((l) => ({ ...l, stateError: String((e as Error)?.message ?? e) }));
      } finally { inflight = false; setRequestPending(false); }
    }, STATE_EVERY_MS);
    return () => window.clearInterval(id);
  }, [listening, nowT, fireNudge]);

  // ---- presence: leaving the tab counts as "last seen" ----
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'hidden') dispatch({ type: 'markSeen', t: nowT() }); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [nowT]);

  // opts.sinceT (e.g. start of a look-away span) overrides the default lastSeenAt window.
  const catchUp = useCallback(async (opts?: { sinceT?: number }) => {
    const s = ref.current;
    const now = nowT();
    const sinceT = opts?.sinceT != null
      ? Math.max(0, Math.min(opts.sinceT, now - 1_000))
      : Math.max(0, now - CATCHUP_MAX_MS, Math.min(s.lastSeenAt, now - CATCHUP_MIN_MS));
    setCatchup({ status: 'loading', startedAt: Date.now() });
    setRequestPending(true);
    const t0 = performance.now();
    try {
      const raw = await postCatchup({ me: s.me, speakers: s.speakers, window: windowSince(s, sinceT), sinceT, nowT: now });
      if (raw.degraded) throw new Error('Catch-up is slow right now. Try again.');
      // Lanes: resolve each bullet's thread label to a known Thread.id (same fuzzy match as the server).
      const lanes = ref.current.threads;
      const data = { ...raw, bullets: (raw.bullets ?? []).map((b) => {
        const threadId = matchThread(b.thread, lanes);
        return threadId ? { ...b, threadId } : b;
      }) };
      const ms = data.latencyMs ?? Math.round(performance.now() - t0);
      setLatency((l) => ({ ...l, catchupMs: ms }));
      setCatchup({ status: 'ready', data, at: Date.now(), latencyMs: ms });
      dispatch({ type: 'markSeen', t: now });
    } catch (e) {
      setCatchup({ status: 'error', message: String((e as Error)?.message ?? e), at: Date.now() });
    } finally { setRequestPending(false); }
  }, [nowT]);

  // Rolling "What did I miss?": refreshed by itself every 10 s whenever >= 2 new finals arrived since the last
  // run, so a tap shows it instantly. It never marks the window as seen and never touches the on-demand state.
  const [missed, setMissed] = useState<{ data: CatchupResponse; at: number; sinceT: number } | null>(null);
  const missedRun = useRef({ busy: false, lastFinalCount: 0 });
  useEffect(() => {
    if (!started) return;
    const id = window.setInterval(async () => {
      const s = ref.current;
      if (missedRun.current.busy) return;
      const finals = s.timeline.filter((i) => isUtt(i) && i.final && i.text.trim()).length;
      if (finals - missedRun.current.lastFinalCount < 2) return;
      missedRun.current.busy = true;
      missedRun.current.lastFinalCount = finals;
      const now = nowT();
      const sinceT = Math.max(0, now - CATCHUP_MAX_MS, Math.min(s.lastSeenAt, now - CATCHUP_MIN_MS));
      try {
        const raw = await postCatchup({ me: s.me, speakers: s.speakers, window: windowSince(s, sinceT), sinceT, nowT: now });
        if (!raw.degraded) setMissed({ data: raw, at: Date.now(), sinceT });
      } catch { /* keep the previous one */ } finally { missedRun.current.busy = false; }
    }, 10_000);
    return () => window.clearInterval(id);
  }, [started, nowT]);

  const hasFinals = session.timeline.some((i) => isUtt(i) && i.final);
  // Expire the AI mood 20 s after it arrived (re-render so `mood` flips to null and the UI falls back).
  const [, setMoodTick] = useState(0);
  useEffect(() => {
    if (!aiMood) return;
    const id = window.setTimeout(() => setMoodTick((n) => n + 1), Math.max(0, AI_MOOD_FRESH_MS - (Date.now() - aiMood.at)) + 50);
    return () => window.clearTimeout(id);
  }, [aiMood]);
  const mood = aiMood && Date.now() - aiMood.at < AI_MOOD_FRESH_MS ? aiMood : null;

  return {
    session,
    asr, latency, listening, hasFinals, participants,
    lastTranscriptAt, requestPending, micLevel,
    nudge, dismissNudge: useCallback(() => setNudge(null), []),
    catchup, catchUp, dismissCatchup: useCallback(() => setCatchup({ status: 'idle' }), []),
    missed, // rolling catch-up, always fresh (see effect above)
    setListening,
    started, start: useCallback(() => setStarted(true), []),
    table, laughAt, phonesOnly, phonesOnlyPref, setPhonesOnly: useCallback((v: boolean) => setPhonesOnlyPref(v), []),
    // "Speak for me": ME's TTS line enters the timeline as a final utterance (speaker -2) and dirties the ledger loop.
    addLocalUtterance: useCallback((text: string, durMs = 2000) => {
      dispatch({ type: 'localUtterance', text, t: Date.now() - ref.current.startedAt, durMs });
      dirty.current = true;
    }, []),
    renameSpeaker: useCallback((id: number, name: string) => dispatch({ type: 'renameSpeaker', id, name }), []),
    mergeSpeaker: useCallback((from: number, to: number) => dispatch({ type: 'mergeSpeaker', from, to }), []),
    setMe: useCallback((name: string, aliases: string[]) => {
      dispatch({ type: 'setMe', name, aliases });
      try { localStorage.setItem('imt.me', JSON.stringify({ name, aliases })); } catch { /* ignore */ }
    }, []),
    nowT,
    // Lanes + doubt words (see state/confidence.ts, state/useRepeat.ts)
    threads: session.threads,
    utterancesByThread: useCallback((threadId: string) => utterancesByThread(ref.current, threadId), []),
    markRepeat: useCallback((id: string) => dispatch({ type: 'markRepeat', id }), []),
    // Fast decision gate (header latency chip + debug)
    gateLatencyMs, lastGate,
    // AI mood from /api/state: { table: 'warm'|'tense'|'light'|'quiet', speakers: [{ name, mood: Tone }], at } or null when
    // older than 20 s (then derive it client-side with lib/mood). aiMood = the last one regardless of age.
    mood, aiMood,
  };
}
export type SessionApi = ReturnType<typeof useSession>;
