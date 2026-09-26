// "Away" detection: notices (on-device) when ME looks away from the table and
// records those spans on the session clock. Only a boolean + two angles ever
// leave gaze.ts; no frame is stored. `?away=1` simulates it with the A key.
import { useCallback, useEffect, useRef, useState } from 'react';
import { startGaze, type GazeState } from '../gaze/gaze';

export interface AwayInterval { t0: number; t1: number }
interface Opts {
  /** Session-clock getter (ms since session start). */
  nowSessionMs: () => number;
  /** Fired when an away span closes (ME looked back at the table). */
  onReturn?: (interval: AwayInterval) => void;
}

const LS_KEY = 'imt.away';
const LS_BASELINE = 'imt.away.baseline';
const CALIBRATE_MS = 1500;

export const awaySimulated = (): boolean => {
  try { return new URLSearchParams(window.location.search).get('away') === '1'; } catch { return false; }
};
function loadEnabled(): boolean {
  try { return localStorage.getItem(LS_KEY) === '1'; } catch { return false; }
}
function loadBaseline(): { pitch: number; yaw: number } {
  try {
    const v = JSON.parse(localStorage.getItem(LS_BASELINE) ?? 'null');
    if (typeof v?.pitch === 'number' && typeof v?.yaw === 'number') return v;
  } catch { /* ignore */ }
  return { pitch: 0, yaw: 0 };
}

export function useAway({ nowSessionMs, onReturn }: Opts) {
  const sim = useRef(awaySimulated()).current;
  const [enabledPref, setEnabledPref] = useState(loadEnabled);
  const enabled = sim || enabledPref;
  const [away, setAway] = useState(false);
  const [awaySince, setAwaySince] = useState<number | null>(null);
  const [intervals, setIntervals] = useState<AwayInterval[]>([]);
  const [active, setActive] = useState(false); // camera + model actually running
  const [calibrating, setCalibrating] = useState(false);

  const baseline = useRef(loadBaseline());
  const last = useRef<GazeState | null>(null);
  const samples = useRef<{ pitch: number; yaw: number }[] | null>(null);
  const awayRef = useRef<{ away: boolean; t0: number | null }>({ away: false, t0: null });
  const nowRef = useRef(nowSessionMs); nowRef.current = nowSessionMs;
  const onReturnRef = useRef(onReturn); onReturnRef.current = onReturn;

  const setEnabled = useCallback((v: boolean) => {
    setEnabledPref(v);
    try { localStorage.setItem(LS_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  }, []);

  /** Single entry point for both the camera and the simulator. */
  const applyAway = useCallback((next: boolean, silent = false) => {
    const cur = awayRef.current;
    if (next === cur.away) return;
    const t = nowRef.current();
    if (next) {
      awayRef.current = { away: true, t0: t };
      setAway(true); setAwaySince(t);
    } else {
      const iv = { t0: cur.t0 ?? t, t1: t };
      awayRef.current = { away: false, t0: null };
      setAway(false); setAwaySince(null);
      setIntervals((xs) => [...xs, iv]);
      if (!silent) onReturnRef.current?.(iv);
    }
  }, []);

  // ---- camera path ----
  useEffect(() => {
    if (!enabled || sim) return;
    const video = document.createElement('video'); // never attached to the DOM, never drawn
    let handle: { stop: () => void } | null = null;
    let cancelled = false;
    void startGaze(video, (s) => {
      last.current = s;
      setActive(true);
      if (samples.current && s.faceFound) samples.current.push({ pitch: s.pitch, yaw: s.yaw });
      applyAway(s.away);
    }, { getBaseline: () => baseline.current }).then((h) => { if (cancelled) h.stop(); else handle = h; });
    return () => {
      cancelled = true;
      handle?.stop();
      setActive(false);
      applyAway(false, true); // turning the feature off is not "looking back"
    };
  }, [enabled, sim, applyAway]);

  // ---- simulator: ?away=1, press A to toggle ----
  useEffect(() => {
    if (!sim) return;
    setActive(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'a' && e.key !== 'A') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      applyAway(!awayRef.current.away);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sim, applyAway]);

  /** Sample the current pose for 1.5 s and make it the "looking at the table" baseline. */
  const calibrate = useCallback(async (): Promise<boolean> => {
    if (sim || !enabled) return false;
    setCalibrating(true);
    samples.current = [];
    await new Promise((r) => window.setTimeout(r, CALIBRATE_MS));
    const xs = samples.current;
    samples.current = null;
    setCalibrating(false);
    if (!xs.length) { console.warn('[away] calibration: no face seen'); return false; }
    const mean = (k: 'pitch' | 'yaw') => xs.reduce((a, x) => a + x[k], 0) / xs.length;
    baseline.current = { pitch: mean('pitch'), yaw: mean('yaw') };
    try { localStorage.setItem(LS_BASELINE, JSON.stringify(baseline.current)); } catch { /* ignore */ }
    return true;
  }, [sim, enabled]);

  const lastAway = intervals.length ? intervals[intervals.length - 1] : null;
  return { enabled, setEnabled, sim, active, away, awaySince, intervals, lastAway, calibrate, calibrating };
}
export type AwayApi = ReturnType<typeof useAway>;
