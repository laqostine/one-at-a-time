// Non-speech audio event detection (laughter, applause, ...) with YAMNet on TF.js.
// Feed 16kHz mono Float32 frames via push(). Never throws: on any failure it logs and disables itself.
import type { EventKind } from '../../../shared/types';

type TF = typeof import('@tensorflow/tfjs');
type GraphModel = Awaited<ReturnType<TF['loadGraphModel']>>;

const MODEL_URL = 'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1';
const CLASS_MAP_URL = 'https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv';
const WINDOW = 15600; // 0.975s @ 16kHz
const THRESHOLD = 0.35;
const CONSECUTIVE = 2;
const DEBOUNCE_MS = 3000;

// First comma-segment of YAMNet display_name -> our kind
const WHITELIST: Record<string, EventKind> = {
  laughter: 'laughter', giggle: 'laughter', chuckle: 'laughter',
  applause: 'applause',
  cheering: 'cheering',
  alarm: 'alarm', siren: 'alarm',
  doorbell: 'doorbell',
  knock: 'knock',
  'telephone bell ringing': 'phone', ringtone: 'phone',
  music: 'music',
};

let classMapPromise: Promise<string[]> | null = null;
function loadClassMap(): Promise<string[]> {
  if (!classMapPromise) {
    classMapPromise = fetch(CLASS_MAP_URL)
      .then((r) => { if (!r.ok) throw new Error(`class map HTTP ${r.status}`); return r.text(); })
      .then(parseClassMap)
      .catch((e: unknown) => { classMapPromise = null; throw e; });
  }
  return classMapPromise;
}

function parseClassMap(csv: string): string[] {
  const names: string[] = [];
  for (const line of csv.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    // index,mid,display_name  (display_name may be quoted and contain commas)
    const m = /^(\d+),([^,]*),(.*)$/.exec(line);
    if (!m) continue;
    let name = m[3].trim();
    if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1).replace(/""/g, '"');
    names[Number(m[1])] = name;
  }
  return names;
}

let modelPromise: Promise<{ tf: TF; model: GraphModel }> | null = null;
function loadModel(): Promise<{ tf: TF; model: GraphModel }> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      const model = await tf.loadGraphModel(MODEL_URL, { fromTFHub: true });
      return { tf, model };
    })().catch((e: unknown) => { modelPromise = null; throw e; });
  }
  return modelPromise;
}

export interface EventsHandle { push: (f32: Float32Array) => void; stop: () => void }

export function startEvents(onEvent: (e: { kind: EventKind; score: number }) => void): EventsHandle {
  let disabled = false;
  let stopped = false;
  let busy = false;
  let ready: { tf: TF; model: GraphModel; groups: Map<EventKind, number[]> } | null = null;

  const buf = new Float32Array(WINDOW);
  let fill = 0;
  const streak = new Map<EventKind, number>();
  const lastEmit = new Map<EventKind, number>();

  (async () => {
    try {
      const [{ tf, model }, names] = await Promise.all([loadModel(), loadClassMap()]);
      const groups = new Map<EventKind, number[]>();
      names.forEach((n, i) => {
        const kind = WHITELIST[n.split(',')[0].trim().toLowerCase()];
        if (!kind) return;
        const g = groups.get(kind) ?? [];
        g.push(i);
        groups.set(kind, g);
      });
      if (!groups.size) throw new Error('no whitelisted classes found in class map');
      ready = { tf, model, groups };
      console.info('[events] YAMNet ready', Object.fromEntries(groups));
    } catch (e) {
      disabled = true;
      console.warn('[events] YAMNet disabled:', e);
    }
  })();

  const infer = async (win: Float32Array) => {
    if (!ready) return;
    const { tf, model, groups } = ready;
    busy = true;
    try {
      const mean = tf.tidy(() => {
        const out = model.predict(tf.tensor1d(win));
        const scores = Array.isArray(out) ? out[0] : (out as import('@tensorflow/tfjs').Tensor);
        return scores.rank === 2 ? scores.mean(0) : scores.reshape([-1]);
      });
      const data = (await mean.data()) as Float32Array;
      mean.dispose();
      if (stopped) return;
      const now = performance.now();
      for (const [kind, idxs] of groups) {
        let s = 0;
        for (const i of idxs) if (data[i] > s) s = data[i];
        if (s > THRESHOLD) {
          const n = (streak.get(kind) ?? 0) + 1;
          streak.set(kind, n);
          if (n >= CONSECUTIVE && now - (lastEmit.get(kind) ?? -Infinity) > DEBOUNCE_MS) {
            lastEmit.set(kind, now);
            try { onEvent({ kind, score: s }); } catch (err) { console.warn('[events] onEvent threw', err); }
          }
        } else {
          streak.set(kind, 0);
        }
      }
    } catch (e) {
      disabled = true;
      console.warn('[events] inference failed, disabling:', e);
    } finally {
      busy = false;
    }
  };

  return {
    push: (f32: Float32Array) => {
      if (disabled || stopped) return;
      try {
        let off = 0;
        while (off < f32.length) {
          const n = Math.min(WINDOW - fill, f32.length - off);
          buf.set(f32.subarray(off, off + n), fill);
          fill += n; off += n;
          if (fill === WINDOW) {
            fill = 0;
            // drop the window if the model isn't loaded yet or still busy with the previous one
            if (ready && !busy) void infer(buf.slice());
          }
        }
      } catch (e) {
        disabled = true;
        console.warn('[events] push failed, disabling:', e);
      }
    },
    stop: () => { stopped = true; fill = 0; streak.clear(); },
  };
}
