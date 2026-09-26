// Replay engine — demo insurance. Plays a recorded scenario file back in real
// time through the exact same message shapes the live WS would produce, so
// the rest of the app (state engine, UI) cannot tell the difference.
//
// Loads `/replay/${name}.json` (served from client/public/replay) and feeds
// it to the given callbacks on a real-time clock (scaled by `speed`).
import type { AsrMessage, EventKind } from '../../../shared/types';

/** One scripted spoken line in a replay scenario file. */
export interface ReplayLine {
  t: number;        // ms since scenario start when the speaker starts talking
  speaker: number;  // diarization id, matches `names`
  text: string;     // full final text of the line
  durMs: number;    // how long the line takes to "finish" (interim -> final)
  lowWords?: string[]; // words the fake ASR is unsure about (c=0.4 on the final; others 0.95)
}

const normWord = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Per-word confidences for a replay final, timed evenly across the line (ms since scenario start). */
export function replayWords(line: ReplayLine): { w: string; c: number; t0: number; t1: number }[] {
  const words = line.text.split(/\s+/).filter(Boolean);
  const low = new Set((line.lowWords ?? []).map(normWord));
  const step = line.durMs / Math.max(1, words.length);
  return words.map((w, i) => ({
    w, c: low.has(normWord(w)) ? 0.4 : 0.95,
    t0: Math.round(line.t + i * step), t1: Math.round(line.t + (i + 1) * step),
  }));
}

/** One scripted non-speech audio event in a replay scenario file. */
export interface ReplayEvent {
  t: number;         // ms since scenario start
  event: EventKind;
  score?: number;    // 0..1 confidence, defaults to 0.9 if omitted
}

export type ReplayItem = ReplayLine | ReplayEvent;

/** The on-disk shape of client/public/replay/<name>.json */
export interface ReplayScenario {
  // Optional display names for speaker ids, e.g. { "0": "Alex", "1": "Sam" }.
  // Purely a UI convenience — the ASR messages themselves only carry ids.
  names?: Record<string, string>;
  lines: ReplayItem[];
}

function isEvent(item: ReplayItem): item is ReplayEvent {
  return (item as ReplayEvent).event !== undefined;
}

const WORD_STEP_MS = 250; // how often interim transcripts grow

/** Per-line audio index, as written by tools/render-replay-audio.mjs. */
type AudioIndex = Record<string, { file: string; ms: number }>;

function soundParamFromLocation(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('sound') === '1';
  } catch {
    return false; // no `window` (SSR/tests) — caller must pass `sound` explicitly
  }
}

let audioUnlocked = false;
let warnedAudioBlocked = false;

/**
 * Must be called from a real user gesture (click/tap) before spoken replay
 * audio will play — browsers block autoplaying <audio> without one. Playing
 * and immediately pausing a silent-length element "unlocks" the audio
 * context for the rest of the session.
 */
export function unlockReplayAudio(): void {
  if (audioUnlocked || typeof Audio === 'undefined') return;
  try {
    const a = new Audio();
    a.play()?.catch(() => {});
    a.pause();
  } catch {
    /* best-effort */
  }
  audioUnlocked = true;
}

function clampRate(speed: number): number {
  return Math.min(2, Math.max(0.5, speed));
}

function playLineAudio(base: string, url: string, speed: number) {
  try {
    const audio = new Audio(url);
    audio.playbackRate = clampRate(speed);
    audio.play()?.catch((err: unknown) => {
      if (!warnedAudioBlocked) {
        warnedAudioBlocked = true;
        console.warn(`[replay] audio playback blocked (${base}); call unlockReplayAudio() on a click first`, err);
      }
    });
  } catch (err) {
    if (!warnedAudioBlocked) {
      warnedAudioBlocked = true;
      console.warn(`[replay] audio playback failed (${base})`, err);
    }
  }
}

export function startReplay(
  name: string,
  onMessage: (m: AsrMessage) => void,
  onEvent: (e: { kind: EventKind; score: number }) => void,
  speed = 1,
  sound: boolean = soundParamFromLocation(),
): { stop: () => void } {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let stopped = false;

  const schedule = (delayMs: number, fn: () => void) => {
    if (stopped) return;
    const scaled = Math.max(0, delayMs / speed);
    const id = setTimeout(() => {
      if (!stopped) fn();
    }, scaled);
    timers.push(id);
  };

  // Kick off asynchronously so callers can attach listeners / call stop()
  // before anything fires, same as a real WebSocket would behave.
  (async () => {
    onMessage({ type: 'status', state: 'connecting' });

    let scenario: ReplayScenario;
    try {
      const res = await fetch(`/replay/${name}.json`);
      if (!res.ok) throw new Error(`replay ${name} -> ${res.status}`);
      scenario = await res.json();
    } catch (err) {
      if (!stopped) {
        onMessage({
          type: 'status',
          state: 'error',
          detail: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    let audioIndex: AudioIndex | null = null;
    if (sound) {
      try {
        const res = await fetch(`/replay/audio/${name}/index.json`);
        if (res.ok) audioIndex = await res.json();
      } catch {
        /* no audio for this scenario — replay still runs silently */
      }
    }

    if (stopped) return;
    onMessage({ type: 'status', state: 'open' });

    scenario.lines.forEach((item, i) => {
      if (isEvent(item)) {
        schedule(item.t, () => onEvent({ kind: item.event, score: item.score ?? 0.9 }));
        return;
      }

      const line = item;
      const audioEntry = audioIndex?.[i];
      if (audioEntry) {
        schedule(line.t, () => playLineAudio(`${name}/${i}`, `/replay/audio/${name}/${audioEntry.file}`, speed));
      }
      const words = line.text.split(/\s+/).filter(Boolean);
      const steps = Math.max(1, Math.min(words.length, Math.round(line.durMs / WORD_STEP_MS)));

      for (let s = 1; s <= steps; s++) {
        const wordCount = Math.max(1, Math.round((words.length * s) / steps));
        const partial = words.slice(0, wordCount).join(' ');
        const stepT = line.t + Math.round((line.durMs * (s - 1)) / steps);
        schedule(stepT, () => {
          onMessage({
            type: 'transcript',
            speaker: line.speaker,
            text: partial,
            tStart: line.t,
            tEnd: stepT,
            final: false,
          });
        });
      }

      schedule(line.t + line.durMs, () => {
        onMessage({
          type: 'transcript',
          speaker: line.speaker,
          text: line.text,
          tStart: line.t,
          tEnd: line.t + line.durMs,
          final: true,
          words: replayWords(line),
        });
      });
    });
  })();

  return {
    stop() {
      stopped = true;
      for (const id of timers) clearTimeout(id);
      timers.length = 0;
    },
  };
}
