// On-device "away" detection. The webcam frame goes straight into MediaPipe's
// FaceLandmarker (WASM, runs locally); we keep only head pitch/yaw numbers and a
// boolean. No frame is ever stored, drawn, or sent anywhere.
import type { FaceLandmarker } from '@mediapipe/tasks-vision';

export interface GazeState { away: boolean; pitch: number; yaw: number; faceFound: boolean }
export interface GazeOpts {
  pitchDownDeg?: number; // default 20: head pitched down this far below baseline => away
  yawDeg?: number;       // default 35: head turned this far left/right of baseline => away
  holdMs?: number;       // default 1200: continuous "away" needed before flipping to away
  /** "Looking at the table" pose; thresholds are relative to it. Read every tick (calibration can change it live). */
  getBaseline?: () => { pitch: number; yaw: number };
}

// Pin the WASM to the installed package version so JS glue + wasm always match.
const TASKS_VERSION = '1.0.1';
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const TICK_MS = 200;          // ~5 fps
const RETURN_HOLD_MS = 600;   // continuous "present" needed before flipping back
const NO_FACE_AWAY_MS = 2000; // no face at all for this long => away
const DEG = 180 / Math.PI;

/**
 * Head pitch/yaw (degrees) from MediaPipe's 4x4 facial transformation matrix.
 * The matrix is column-major (data[col*4 + row]) and maps the canonical face
 * (which looks along +z, y up) into camera space (camera looks down -z, y up).
 * Rotating the canonical forward vector (0,0,1) gives the 3rd column
 * n = (R02, R12, R22): where the nose points.
 *   pitch = atan2(n.y, n.z)  → negative = head tipped DOWN (e.g. at a phone)
 *   yaw   = atan2(n.x, n.z)  → sign = left/right (we only use |yaw|)
 * Equivalent to the Rx(pitch)·Ry(yaw) Euler decomposition for the ranges we
 * care about, without the gimbal/branch issues of asin().
 */
export function headAngles(data: ArrayLike<number>): { pitch: number; yaw: number } {
  const nx = data[8], ny = data[9], nz = data[10];
  return { pitch: Math.atan2(ny, nz) * DEG, yaw: Math.atan2(nx, nz) * DEG };
}

/** Hysteresis state machine, split out so it's testable without a camera. */
export function createAwayMachine(opts: { pitchDownDeg: number; yawDeg: number; holdMs: number }) {
  let away = false;
  let candidateSince: number | null = null; // when the raw signal first disagreed with `away`
  let noFaceSince: number | null = null;
  return (now: number, faceFound: boolean, dPitch: number, dYaw: number): boolean => {
    if (faceFound) noFaceSince = null; else noFaceSince ??= now;
    const rawAway = faceFound
      ? dPitch < -opts.pitchDownDeg || Math.abs(dYaw) > opts.yawDeg
      : true;
    if (rawAway === away) { candidateSince = null; return away; }
    candidateSince ??= faceFound || !rawAway ? now : noFaceSince!;
    const need = !rawAway ? RETURN_HOLD_MS : faceFound ? opts.holdMs : Math.max(NO_FACE_AWAY_MS, opts.holdMs);
    if (now - candidateSince >= need) { away = rawAway; candidateSince = null; }
    return away;
  };
}

export async function startGaze(
  video: HTMLVideoElement,
  onState: (s: GazeState) => void,
  opts: GazeOpts = {},
): Promise<{ stop: () => void }> {
  const noop = { stop: () => {} };
  let stream: MediaStream | null = null;
  let landmarker: FaceLandmarker | null = null;
  let timer: number | undefined;
  let stopped = false;
  const stop = () => {
    stopped = true;
    if (timer !== undefined) window.clearInterval(timer);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    try { video.pause(); video.srcObject = null; } catch { /* ignore */ }
    try { landmarker?.close(); } catch { /* ignore */ }
    landmarker = null;
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false });
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();

    // Dynamic import keeps MediaPipe out of the main bundle.
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    const make = (delegate: 'GPU' | 'CPU') => FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFacialTransformationMatrixes: true,
      outputFaceBlendshapes: false,
    });
    try { landmarker = await make('GPU'); } catch { landmarker = await make('CPU'); }
    if (stopped) { stop(); return noop; }

    const machine = createAwayMachine({
      pitchDownDeg: opts.pitchDownDeg ?? 20, yawDeg: opts.yawDeg ?? 35, holdMs: opts.holdMs ?? 1200,
    });
    let lastTs = 0;
    timer = window.setInterval(() => {
      if (stopped || !landmarker || video.readyState < 2) return;
      try {
        const ts = Math.max(performance.now(), lastTs + 1); // must be strictly increasing
        lastTs = ts;
        const res = landmarker.detectForVideo(video, ts);
        const m = res.facialTransformationMatrixes?.[0];
        const faceFound = !!m && res.faceLandmarks.length > 0;
        const { pitch, yaw } = faceFound ? headAngles(m.data) : { pitch: 0, yaw: 0 };
        const b = opts.getBaseline?.() ?? { pitch: 0, yaw: 0 };
        const away = machine(Date.now(), faceFound, pitch - b.pitch, yaw - b.yaw);
        onState({ away, pitch, yaw, faceFound });
      } catch (e) {
        console.warn('[gaze] detection failed; disabling', e);
        stop();
      }
    }, TICK_MS);
    return { stop };
  } catch (e) {
    console.warn('[gaze] unavailable (camera or model); away detection disabled', e);
    stop();
    return noop;
  }
}
