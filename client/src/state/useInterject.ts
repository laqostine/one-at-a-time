// "Speak for me": draft a re-entry line, then say it aloud (speechSynthesis) at the next
// silence gap in the conversation. Gap = no interim/final transcript for GAP_MS (live or replay —
// both feed the same session timeline), with a MAX_WAIT_MS cap so the user is never stuck.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { InterjectIntent, InterjectOption, InterjectRequest, TimelineItem } from '../../../shared/types';
import { postInterject } from './api';

export const GAP_MS = 700;
export const MAX_WAIT_MS = 4_000;
const POLL_MS = 100;

export type InterjectStatus = 'idle' | 'drafting' | 'ready' | 'waiting' | 'speaking' | 'error';

/** Wall-clock time (Date.now()) of the last timeline change, as a stable getter. */
export function useLastActivity(timeline: TimelineItem[]): () => number {
  const at = useRef(Date.now());
  useEffect(() => { at.current = Date.now(); }, [timeline]);
  return useCallback(() => at.current, []);
}

const TR_RE = /[çğıöşüÇĞİÖŞÜ]|\b(ve|bir|bu|için|ama|değil|evet|hayır|mı|mi|ben|sen|biz|şey|tamam|misin|musun)\b/i;
export const detectLang = (text: string): 'tr' | 'en' => (TR_RE.test(text) ? 'tr' : 'en');

function pickVoice(lang: 'tr' | 'en'): SpeechSynthesisVoice | undefined {
  try {
    const voices = window.speechSynthesis?.getVoices() ?? [];
    const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
    return matching.find((v) => v.localService && v.default) ?? matching.find((v) => v.localService) ?? matching[0];
  } catch { return undefined; }
}

/** Rough spoken duration, used for the timeline entry and as a watchdog when TTS events never fire. */
const estimateMs = (line: string) => Math.max(1200, line.split(/\s+/).filter(Boolean).length * 380 + 400);

interface Options {
  /** Current context for drafting (read at call time). */
  getContext: () => Omit<InterjectRequest, 'intent' | 'custom'>;
  /** Wall-clock ms of the last transcript activity (see useLastActivity). */
  lastActivityAt: () => number;
  /** Called when the line starts being spoken — push it into the session as ME's utterance. */
  onSpoken?: (line: string, durMs: number) => void;
}

export function useInterject({ getContext, lastActivityAt, onSpoken }: Options) {
  const [status, setStatus] = useState<InterjectStatus>('idle');
  const [options, setOptions] = useState<InterjectOption[]>([]);
  const [line, setLine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const ctx = useRef(getContext); ctx.current = getContext;
  const activity = useRef(lastActivityAt); activity.current = lastActivityAt;
  const spoken = useRef(onSpoken); spoken.current = onSpoken;
  const timers = useRef<number[]>([]);
  const abort = useRef<AbortController | null>(null);
  const run = useRef(0); // invalidates stale waits/speech callbacks after stop()

  const clearTimers = () => { timers.current.forEach((id) => window.clearTimeout(id)); timers.current = []; };

  const stop = useCallback(() => {
    run.current++;
    clearTimers();
    try { window.speechSynthesis?.cancel(); } catch { /* unsupported */ }
    setLine(null);
    setStatus((s) => (s === 'waiting' || s === 'speaking' ? (options.length ? 'ready' : 'idle') : s));
  }, [options.length]);

  useEffect(() => () => { run.current++; clearTimers(); abort.current?.abort(); try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }, []);

  const draft = useCallback(async (intent?: InterjectIntent, custom?: string) => {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setStatus('drafting');
    setError(null);
    const t0 = performance.now();
    try {
      const res = await postInterject({ ...ctx.current(), ...(intent ? { intent } : {}), ...(custom ? { custom } : {}) }, ac.signal);
      if (ac.signal.aborted) return [];
      const opts = (res.options ?? []).slice(0, 3);
      setOptions(opts);
      setLatencyMs(res.latencyMs ?? Math.round(performance.now() - t0));
      setStatus('ready');
      return opts;
    } catch (e) {
      if (ac.signal.aborted) return [];
      setError(String((e as Error)?.message ?? e));
      setStatus('error');
      return [];
    }
  }, []);

  /** Speak immediately. */
  const speak = useCallback((text: string) => {
    const my = ++run.current;
    clearTimers();
    const clean = text.trim();
    if (!clean) return;
    const dur = estimateMs(clean);
    setLine(clean);
    setStatus('speaking');
    spoken.current?.(clean, dur);
    const done = () => {
      if (run.current !== my) return;
      run.current++;
      clearTimers();
      setLine(null);
      setStatus('ready');
    };
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (synth && typeof SpeechSynthesisUtterance !== 'undefined') {
      try {
        synth.cancel();
        const u = new SpeechSynthesisUtterance(clean);
        const lang = detectLang(clean);
        u.lang = lang === 'tr' ? 'tr-TR' : 'en-US';
        const v = pickVoice(lang);
        if (v) u.voice = v;
        u.rate = 1.0;
        u.onend = done;
        u.onerror = done;
        synth.speak(u);
      } catch (e) { console.warn('[interject] speechSynthesis failed', e); }
    }
    // Watchdog: some engines (headless, no voices) never fire onend.
    timers.current.push(window.setTimeout(done, dur + 2_500));
  }, []);

  /** Wait for a ≥GAP_MS pause in transcripts (max MAX_WAIT_MS), then speak. */
  const speakAtGap = useCallback((text: string) => {
    const my = ++run.current;
    clearTimers();
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    const clean = text.trim();
    if (!clean) return;
    setLine(clean);
    setStatus('waiting');
    const started = Date.now();
    const tick = () => {
      if (run.current !== my) return;
      const now = Date.now();
      if (now - activity.current() >= GAP_MS || now - started >= MAX_WAIT_MS) { speak(clean); return; }
      timers.current.push(window.setTimeout(tick, POLL_MS));
    };
    tick();
  }, [speak]);

  const reset = useCallback(() => { stop(); abort.current?.abort(); setOptions([]); setError(null); setStatus('idle'); }, [stop]);

  return { status, options, line, error, latencyMs, draft, speak, speakAtGap, stop, reset };
}
export type InterjectApi = ReturnType<typeof useInterject>;
