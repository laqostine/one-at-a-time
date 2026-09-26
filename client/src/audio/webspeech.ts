// Fallback ASR using the browser's Web Speech API (Chrome/Edge/Safari). No diarization: speaker 0.
import type { AsrMessage } from '../../../shared/types';

interface SRAlternative { transcript: string }
interface SRResult { readonly isFinal: boolean; readonly length: number; [i: number]: SRAlternative }
interface SREvent extends Event { readonly resultIndex: number; readonly results: { readonly length: number; [i: number]: SRResult } }
interface SRErrorEvent extends Event { readonly error: string }
interface SR extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type SRCtor = new () => SR;

export function webSpeechSupported(): boolean {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export function startWebSpeech(onMessage: (m: AsrMessage) => void, lang = 'en-US'): { stop: () => void } {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) {
    onMessage({ type: 'status', state: 'error', detail: 'Web Speech API not supported' });
    return { stop: () => undefined };
  }
  const t0 = performance.now();
  const now = () => Math.round(performance.now() - t0);
  let stopped = false;
  // start time of the result currently being built, keyed by result index
  const starts = new Map<number, number>();

  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = lang;
  rec.onstart = () => onMessage({ type: 'status', state: 'open', detail: 'webspeech' });
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const text = (r[0]?.transcript ?? '').trim();
      if (!text) continue;
      if (!starts.has(i)) starts.set(i, now());
      const tStart = starts.get(i) ?? now();
      onMessage({ type: 'transcript', speaker: 0, text, tStart, tEnd: now(), final: r.isFinal });
      if (r.isFinal) starts.delete(i);
    }
  };
  rec.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    onMessage({ type: 'status', state: 'error', detail: `webspeech: ${e.error}` });
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') stopped = true;
  };
  // Chrome ends sessions periodically even in continuous mode; auto-restart.
  rec.onend = () => {
    starts.clear();
    if (stopped) { onMessage({ type: 'status', state: 'closed' }); return; }
    try { rec.start(); } catch { /* already started */ }
  };
  onMessage({ type: 'status', state: 'connecting', detail: 'webspeech' });
  try { rec.start(); } catch (err) {
    onMessage({ type: 'status', state: 'error', detail: `webspeech start failed: ${String(err)}` });
  }
  return {
    stop: () => {
      stopped = true;
      try { rec.stop(); } catch { /* ignore */ }
    },
  };
}
