// Wires audio/replay sources -> reducer, runs the ledger loop, exposes catch-up.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { AsrMessage, CatchupResponse, EventKind, Participant, Session } from '../../../shared/types';
import { startMic } from '../audio/mic';
import { startEvents } from '../audio/events';
import { startWebSpeech } from '../audio/webspeech';
import { startReplay } from '../replay/replay';
import { postCatchup, postState } from './api';
import { initSession, isUtt, lastMinutes, sessionReducer, speakerName, windowSince, type SessionState } from './session';
import { isAddressedToMe } from './addressed';

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

  // ASR times are ms since the *stream* start (reset on reconnect); shift onto the session clock.
  const offset = useRef<number | null>(null);
  const lastRaw = useRef(0);

  const onMessage = useCallback((raw: AsrMessage) => {
    if (raw.type === 'status') {
      if (raw.state === 'open') offset.current = Date.now() - ref.current.startedAt;
      setAsr((a) => ({ ...a, state: raw.state, detail: raw.detail }));
      return;
    }
    if (raw.type === 'participants') { setParticipants(raw.list); return; }
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
    dispatch({ type: 'transcript', msg });
    if (msg.text.trim()) setLastTranscriptAt(Date.now());
    if (!msg.final || !msg.text.trim()) return;
    dirty.current = true;
    const me = ref.current.me;
    if (me.name && isAddressedToMe(msg.text, me)) {
      const speaker = msg.speaker >= 0 ? (ref.current.merged[msg.speaker] ?? msg.speaker) : -1;
      const id = `u${speaker}-${msg.tStart}`;
      dispatch({ type: 'markAddressed', id });
      fireNudge({ id, speaker: speakerName(ref.current, speaker), speakerId: speaker, question: msg.text.trim(), t: msg.tStart });
    }
  }, [fireNudge]);

  const evSeq = useRef(0);
  const onEvent = useCallback((e: { kind: EventKind; score: number }) => {
    const t = Date.now() - ref.current.startedAt;
    dispatch({ type: 'event', event: { id: `e${t}-${evSeq.current++}`, type: 'event', kind: e.kind, t, score: e.score } });
  }, []);

  // ---- audio / replay source lifecycle ----
  useEffect(() => {
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
        await add(startReplay(name, onMessage, onEvent));
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
        await add(startMic(
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
        ));
      } catch (e) {
        await fallback(String((e as Error)?.message ?? e));
      }
    };
    void run();
    return () => { cancelled = true; setParticipants([]); stops.splice(0).forEach((s) => { try { s(); } catch { /* ignore */ } }); };
  }, [listening, onMessage, onEvent]);

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
        const res = await postState({ me: s.me, speakers: s.speakers, window: lastMinutes(s, 3, nowT()), nowT: nowT(), existing: s.ledger });
        const ms = Math.round(performance.now() - t0);
        setLatency((l) => ({ ...l, stateMs: res.latencyMs ?? ms, stateError: undefined }));
        dispatch({ type: 'setLedger', items: res.ledger ?? [] });
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

  const catchUp = useCallback(async () => {
    const s = ref.current;
    const now = nowT();
    const sinceT = Math.max(0, now - CATCHUP_MAX_MS, Math.min(s.lastSeenAt, now - CATCHUP_MIN_MS));
    setCatchup({ status: 'loading', startedAt: Date.now() });
    setRequestPending(true);
    const t0 = performance.now();
    try {
      const data = await postCatchup({ me: s.me, speakers: s.speakers, window: windowSince(s, sinceT), sinceT, nowT: now });
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
  };
}
export type SessionApi = ReturnType<typeof useSession>;
