// Wires audio/replay sources -> reducer, runs the ledger loop, exposes catch-up.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { AsrMessage, CatchupResponse, EventKind, Participant, Session } from '../../../shared/types';
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
const CATCHUP_MIN_MS = 60_000;
const CATCHUP_MAX_MS = 5 * 60_000;
// Double-caption guard: the host mic also hears people talking into their phones.
const DUP_WINDOW_MS = 2_500;
const DUP_OVERLAP = 0.6;
const dupTokens = (t: string) => new Set(t.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').split(/\s+/).filter(Boolean));
/** Fraction of the host line's tokens that also appear in the participant line. */
function dupOverlap(host: Set<string>, part: Set<string>): number {
  if (!host.size) return 0;
  let n = 0;
  for (const w of host) if (part.has(w)) n++;
  return n / host.size;
}
type TranscriptMsg = Extract<AsrMessage, { type: 'transcript' }>;

/** Sources may return {stop}, a stop fn, a promise of either, or nothing — normalize. */
type Stopper = () => void;
async function toStopper(x: unknown): Promise<Stopper> {
  const v = await Promise.resolve(x);
  if (typeof v === 'function') return v as Stopper;
  if (v && typeof (v as { stop?: unknown }).stop === 'function') return () => (v as { stop: Stopper }).stop();
  return () => {};
}

function replayName(): string | null {
  try { return new URLSearchParams(window.location.search).get('replay'); } catch { return null; }
}

function loadMe(): Session['me'] {
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
  // "Use phones only": null = user hasn't chosen => ON by default once a phone joins.
  const [phonesOnlyPref, setPhonesOnlyPref] = useState<boolean | null>(null);
  const micRef = useRef<MicHandle | null>(null);
  const hostMutedRef = useRef(false);
  const participantsRef = useRef<Participant[]>([]);
  const partFinals = useRef<{ at: number; tokens: Set<string> }[]>([]);
  const heldHost = useRef(new Map<string, { msg: TranscriptMsg; tokens: Set<string>; timer: number }>());
  const [asr, setAsr] = useState<{ state: AsrState; detail?: string; source: Source }>({
    state: 'idle', source: replayName() ? 'replay' : 'mic',
  });
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [catchup, setCatchup] = useState<CatchupState>({ status: 'idle' });
  const [latency, setLatency] = useState<{ stateMs?: number; catchupMs?: number; stateError?: string }>({});
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
    const msg = { ...raw, tStart: raw.tStart + offset.current, tEnd: raw.tEnd + offset.current };
    // Double-caption guard: drop a host-mic final if a phone final with >=60% of its words arrived within ±2.5 s.
    if (msg.final && msg.text.trim()) {
      const at = Date.now();
      const tokens = dupTokens(msg.text);
      if (raw.name) {
        partFinals.current = partFinals.current.filter((f) => at - f.at <= DUP_WINDOW_MS);
        partFinals.current.push({ at, tokens });
        for (const [k, h] of heldHost.current) {
          if (dupOverlap(h.tokens, tokens) >= DUP_OVERLAP) {
            window.clearTimeout(h.timer);
            heldHost.current.delete(k);
            dispatch({ type: 'transcript', msg: { ...h.msg, text: '' } }); // clears that speaker's interim
          }
        }
      } else if (participantsRef.current.length > 0 && !hostMutedRef.current) {
        if (partFinals.current.some((f) => at - f.at <= DUP_WINDOW_MS && dupOverlap(tokens, f.tokens) >= DUP_OVERLAP)) {
          dispatch({ type: 'transcript', msg: { ...msg, text: '' } });
          return;
        }
        // A phone's copy may still be on its way: hold the host line for the window, then commit.
        const k = `${msg.speaker}-${msg.tStart}`;
        const timer = window.setTimeout(() => { heldHost.current.delete(k); commit(msg); }, DUP_WINDOW_MS);
        heldHost.current.set(k, { msg, tokens, timer });
        return;
      }
    }
    commit(msg);
  }, [fireNudge]);

  const commit = useCallback((msg: TranscriptMsg) => {
    dispatch({ type: 'transcript', msg });
    if (msg.text.trim()) setLastTranscriptAt(Date.now());
    if (!msg.final || !msg.text.trim()) return;
    dirty.current = true;
    const me = ref.current.me;
    const speaker = msg.speaker >= 0 ? (ref.current.merged[msg.speaker] ?? msg.speaker) : -1;
    const id = `u${speaker}-${msg.tStart}`;
    // Regex first pass stays instant; the gate below can only add nudges, never delay this one.
    if (me.name && isAddressedToMe(msg.text, me)) {
      dispatch({ type: 'markAddressed', id });
      fireNudge({ id, speaker: speakerName(ref.current, speaker), speakerId: speaker, question: msg.text.trim(), t: msg.tStart });
    }
    gateUtterance({ id, type: 'utterance', speaker, text: msg.text.trim(), tStart: msg.tStart, tEnd: msg.tEnd, final: true });
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

  // ---- phones-only: mute this device's mic while >= 1 phone is joined (default ON) ----
  const phonesOnly = (phonesOnlyPref ?? true) && participants.length > 0;
  useEffect(() => {
    hostMutedRef.current = phonesOnly;
    micRef.current?.setMuted(phonesOnly);
  }, [phonesOnly]);
  useEffect(() => { if (!participants.length) setTable(null); }, [participants.length]);

  // ---- tell the room our name so phones can say "Good pace for <name>" ----
  const asrOpen = asr.state === 'open';
  useEffect(() => {
    if (!session.me.name || replayName()) return;
    void fetch('/api/room/me', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: session.me.name }) }).catch(() => {});
  }, [session.me.name, asrOpen]);

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
        const ms = Math.round(performance.now() - t0);
        setLatency((l) => ({ ...l, stateMs: res.latencyMs ?? ms, stateError: undefined }));
        coveredT.current = Math.max(coveredT.current, covered);
        dispatch({ type: 'setLedger', items: res.ledger ?? [], coveredT: covered });
        if (res.threads) dispatch({ type: 'applyThreads', threads: res.threads, utteranceThreads: res.utteranceThreads ?? [] });
        const a = res.addressed_to_me_now;
        if (a && ref.current.me.name) fireNudge({ id: `s-${a.t}`, speaker: a.speaker, question: a.question, t: a.t });
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

  const hasFinals = session.timeline.some((i) => isUtt(i) && i.final);

  return {
    session,
    asr, latency, listening, hasFinals, participants,
    lastTranscriptAt, requestPending, micLevel,
    nudge, dismissNudge: useCallback(() => setNudge(null), []),
    catchup, catchUp, dismissCatchup: useCallback(() => setCatchup({ status: 'idle' }), []),
    setListening,
    started, start: useCallback(() => setStarted(true), []),
    table, phonesOnly, phonesOnlyPref, setPhonesOnly: useCallback((v: boolean) => setPhonesOnlyPref(v), []),
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
  };
}
export type SessionApi = ReturnType<typeof useSession>;
