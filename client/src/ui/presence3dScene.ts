// three.js scene for Presence3D — kept in its own module so `three` is only pulled in via
// dynamic import (lazy chunk). Ported from the jarvis project's `Varlik3D`
// (~/.claude/jarvis/web/Varlik3D.tsx): a floating silk "veil" with a head, glowing eyes and a
// mouth. It leans toward you while listening, sways while thinking, ripples with sound
// while speaking and straightens up the moment you start talking.
import * as THREE from 'three';
import type { PresenceState } from './Presence';

// Tuned for the warm-dark identity. Amber is NOT a state color: it is reserved for the
// "addressed to you" flare (FLARE), so it keeps its meaning everywhere in the app.
export const COLOR: Record<PresenceState, number> = {
  idle: 0xa39a8c,         // warm stone
  listening: 0x8db6ff,    // brand accent
  transcribing: 0x7fd8ff, // lighter cyan: "writing"
  thinking: 0xb99dff,     // violet
  speaking: 0x6fd6a4,     // green
};
export const FLARE = 0xf6b93b;

// Posture vocabulary: lean (toward you), sway (side to side), wave (cloth motion),
// glow (inner light), eyes (openness — sleepy / wide / narrowed).
// breath: swell speed (rad/s), shimmer: travelling light bands (transcribing), spin: slow turn (thinking).
const CHARACTER: Record<PresenceState, { lean: number; sway: number; wave: number; glow: number; eyes: number; breath: number; shimmer: number; spin: number }> = {
  idle:         { lean: 0.00, sway: 0.35, wave: 0.45, glow: 0.45, eyes: 0.30, breath: 0.45, shimmer: 0.0, spin: 0.0 }, // sleepy
  listening:    { lean: 1.00, sway: 0.12, wave: 0.50, glow: 0.80, eyes: 1.00, breath: 0.60, shimmer: 0.0, spin: 0.0 }, // calm slow breath
  transcribing: { lean: 0.35, sway: 0.40, wave: 1.10, glow: 0.85, eyes: 0.75, breath: 1.60, shimmer: 1.0, spin: 0.0 }, // quick shimmer
  thinking:     { lean: 0.15, sway: 0.70, wave: 0.70, glow: 0.90, eyes: 0.45, breath: 0.90, shimmer: 0.0, spin: 1.0 }, // slow turn + pulse
  speaking:     { lean: 0.55, sway: 0.25, wave: 1.00, glow: 1.00, eyes: 0.85, breath: 1.00, shimmer: 0.0, spin: 0.0 },
};

const VERTEX = `
uniform float uTime, uLean, uSway, uWave, uLevel, uStartle, uMouth, uBreath, uFlare;
varying vec2 vUV; varying vec3 vNormalV; varying vec3 vView;

void main(){
  vUV = uv;             // u: around, v: top to bottom (0 head, 1 hem)
  float v = uv.y;
  vec3 p = position;

  // CLOTH WAVE: calm at the top, growing toward the hem — a hanging veil.
  float weight = pow(v, 1.6);
  float d1 = sin(uv.x * 6.2832 * 3.0 + uTime * 1.4 + v * 5.0);
  float d2 = sin(uv.x * 6.2832 * 5.0 - uTime * 0.9 + v * 9.0);
  float amp = (0.045 * d1 + 0.025 * d2) * weight * uWave;
  // Sound touches the body: the voice ripples through the cloth.
  amp += uLevel * 0.06 * sin(v * 14.0 - uTime * 6.0) * weight;
  vec3 n = normalize(vec3(p.x, 0.0, p.z) + vec3(0.0001));
  p += n * amp;

  // HEM flutter: free ends at the bottom
  float hem = smoothstep(0.78, 1.0, v);
  p.x += sin(uTime * 1.1 + uv.x * 12.0) * 0.05 * hem * uWave;
  p.z += cos(uTime * 0.8 + uv.x * 9.0) * 0.05 * hem * uWave;

  // SWAY: pendulum, stronger at the bottom (pronounced while thinking)
  p.x += sin(uTime * 0.7) * 0.14 * uSway * pow(v, 1.3);

  // LEAN — the companion gesture: the head comes toward you. Pivot at the hem.
  float fwd = uLean * 0.42 * pow(1.0 - v, 1.4);
  p.z += fwd;
  p.y += -fwd * 0.25;

  // STARTLE: straightening up — the whole body lifts for a moment
  p.y += uStartle * 0.06 * (1.0 - v);

  // BREATH: swell; phase is integrated on the CPU so speed changes never jump.
  p *= 1.0 + 0.026 * sin(uBreath) + uFlare * 0.04;

  // SPEAKING BODY: chest puffs forward-up with the voice, plus a fine shimmer.
  p.z += uMouth * 0.05 * pow(1.0 - v, 1.5);
  p += n * uMouth * 0.018 * sin(v * 22.0 - uTime * 9.0) * weight;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = -mv.xyz;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = `
uniform vec3 uColor, uFlareColor; uniform float uGlow, uTime, uBlink, uEyesOpen, uGazeX, uGazeY, uMouth, uShimmer, uFlare, uPulse;
varying vec2 vUV; varying vec3 vNormalV; varying vec3 vView;

// One eye: glowing soft oval. open=0 -> closed line.
float eye(vec2 g, vec2 center, float open){
  vec2 d = g - center;
  float e = pow(d.x / 0.024, 2.0) + pow(d.y / max(0.038 * open, 0.004), 2.0);
  return smoothstep(1.0, 0.45, e);
}

void main(){
  float v = vUV.y;
  float alphaAdd = 0.0;
  vec3 N = normalize(vNormalV);
  vec3 V = normalize(vView);

  // Milky veil: soft body, edges (fresnel) glow. Warm milk so it sits on the warm-dark UI.
  float rim = pow(1.0 - abs(dot(N, V)), 2.0);
  vec3 milk = vec3(0.96, 0.92, 0.86);
  vec3 tint = mix(uColor, uFlareColor, uFlare);
  float glow = uGlow * (1.0 + 0.18 * uPulse) + uFlare * 0.6;

  // INNER LIGHT: state color at chest height — lit from inside, not painted on.
  float chest = exp(-pow((v - 0.32) * 3.2, 2.0));
  float core = exp(-pow((v - 0.30) * 6.0, 2.0)) * (1.0 - rim);   // small hot core
  vec3 col = milk * (0.18 + rim * 0.62) + tint * chest * 0.9 * glow + tint * rim * 0.42 + mix(tint, vec3(1.0), 0.55) * core * 0.35 * glow;

  // SHIMMER (transcribing): thin light bands travel down the veil like lines being written.
  float band = pow(0.5 + 0.5 * sin(v * 38.0 - uTime * 7.0), 10.0) * smoothstep(0.18, 0.4, v) * smoothstep(0.95, 0.6, v);
  col += mix(tint, vec3(1.0), 0.4) * band * 0.28 * uShimmer;

  // EYES — on the front (u=0.25 faces the camera), on the head dome.
  {
    float open = uEyesOpen * (1.0 - uBlink);
    vec2 gaze = vec2(uGazeX * 0.016, uGazeY * 0.012);
    float g1 = eye(vUV, vec2(0.25 - 0.055, 0.145) + gaze, open);
    float g2 = eye(vUV, vec2(0.25 + 0.055, 0.145) + gaze, open);
    float gz = max(g1, g2);
    col = mix(col, vec3(1.0, 0.97, 0.9), gz * 0.92);
    col += tint * gz * 0.35;
    alphaAdd = gz * 0.9;

    // MOUTH: under the eyes; fixed width, height follows the voice envelope.
    vec2 am = vUV - vec2(0.25, 0.215);
    float ay = max(0.005 + 0.034 * uMouth, 0.004);
    float ae = pow(am.x / 0.026, 2.0) + pow(am.y / ay, 2.0);
    float mouth = smoothstep(1.0, 0.45, ae);
    col = mix(col, vec3(1.0, 0.93, 0.82), mouth * 0.85);
    col += tint * mouth * 0.3;
    alphaAdd += mouth * 0.85;
  }

  // Translucency: the hem dissolves into the air, the top starts soft.
  float alpha = 0.36 + rim * 0.52 + chest * 0.28 * glow + band * 0.15 * uShimmer + alphaAdd;
  alpha *= smoothstep(1.0, 0.62, v);
  alpha *= smoothstep(0.0, 0.06, v);
  gl_FragColor = vec4(col, alpha);
}`;

/** Veil surface; the vertical profile draws a head and a hem.
 * Detail halved vs jarvis (96x72 -> 48x36): at <=160 CSS px the difference is invisible. */
function veilGeometry(): THREE.BufferGeometry {
  const AROUND = 48, TALL = 36;
  const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
  const profile = (v: number): number => {
    // closed top -> round head dome -> slight neck -> widening hem
    const bt = Math.min(v / 0.26, 1);
    const head = Math.sqrt(1 - (1 - bt) * (1 - bt)) * 0.40;
    const neck = 1 - 0.16 * Math.exp(-((v - 0.44) ** 2) / 0.012);
    const hem = 1 + 0.55 * Math.max(0, v - 0.5) ** 1.4;
    return head * neck * hem;
  };
  for (let j = 0; j <= TALL; j++) {
    const v = j / TALL;
    const r = profile(v);
    const y = 1.05 - v * 2.0;
    for (let i = 0; i <= AROUND; i++) {
      const a = (i / AROUND) * Math.PI * 2;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      uvs.push(i / AROUND, v);
    }
  }
  for (let j = 0; j < TALL; j++) {
    for (let i = 0; i < AROUND; i++) {
      const a = j * (AROUND + 1) + i, b = a + AROUND + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export interface SceneInputs {
  state: PresenceState;
  level: number;
  envelope?: Float32Array;
  envelopeStart: number; // performance.now() when the current envelope began
  envelopeStepMs: number;
  /** Increment to fire a brief amber "addressed to you" flare. */
  flare?: number;
}

/** Mounts the scene into `el`. Returns a disposer, or null if WebGL init failed. */
export function mountPresenceScene(el: HTMLElement, size: number, read: () => SceneInputs): (() => void) | null {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0.1, 4.2);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  // Small presences (header 72px) are rendered supersampled so they stay crisp; big ones cap at 2x.
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(size <= 120 ? Math.min(dpr * 1.5, 3) : Math.min(dpr, 2));
  renderer.setSize(size, size, false);
  const canvas = renderer.domElement;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.presence3d = '';
  el.appendChild(canvas);

  const u = {
    uTime: { value: 0 },
    uLean: { value: 0 },
    uSway: { value: CHARACTER.idle.sway },
    uWave: { value: CHARACTER.idle.wave },
    uLevel: { value: 0 },
    uStartle: { value: 0 },
    uGlow: { value: CHARACTER.idle.glow },
    uBlink: { value: 0 },
    uEyesOpen: { value: CHARACTER.idle.eyes },
    uGazeX: { value: 0 },
    uGazeY: { value: 0 },
    uMouth: { value: 0 },
    uBreath: { value: 0 },
    uShimmer: { value: 0 },
    uFlare: { value: 0 },
    uPulse: { value: 0 },
    uColor: { value: new THREE.Color(COLOR[read().state]) },
    uFlareColor: { value: new THREE.Color(FLARE) },
  };
  const geometry = veilGeometry();
  const material = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const veil = new THREE.Mesh(geometry, material);
  scene.add(veil);

  const targetColor = new THREE.Color();
  let smoothLevel = 0;
  let prevSound = 0;
  let startle = 0;
  // Reduced motion: time is frozen, so the figure holds still (colors/eyes still ease).
  let t = 0, raf = 0, lastDraw = 0;
  let nextBlink = performance.now() + 4000 + Math.random() * 4000;
  let blinkStart = -1;
  let running = true;
  let lastFlare = read().flare ?? 0;
  let flare = 0;
  let spin = 0;

  // Eyes drift toward the pointer (a little): the gaze is local to this presence's position.
  let px = 0, py = 0, pointerAt = 0;
  const onPointer = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const reach = Math.max(260, r.width * 2);
    px = Math.max(-1, Math.min(1, (e.clientX - cx) / reach));
    py = Math.max(-1, Math.min(1, (e.clientY - cy) / reach));
    pointerAt = performance.now();
  };
  window.addEventListener('pointermove', onPointer, { passive: true });
  let gx = 0, gy = 0;

  const loop = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (now - lastDraw < 31) return; // ~30 FPS
    lastDraw = now;

    const inp = read();
    const k = CHARACTER[inp.state];
    if (!reduceMotion) t += 0.016;

    smoothLevel += (Math.min(1, inp.level * 2.2) - smoothLevel) * 0.12;

    // CONDITIONAL ATTENTION: straightens up the moment you start talking.
    if (smoothLevel > 0.12 && prevSound <= 0.12) startle = 1;
    prevSound = smoothLevel;
    startle *= 0.93;

    u.uTime.value = t;
    if (!reduceMotion) u.uBreath.value += 0.033 * k.breath;
    u.uShimmer.value += ((reduceMotion ? 0 : k.shimmer) - u.uShimmer.value) * 0.06;
    u.uPulse.value = reduceMotion ? 0 : (inp.state === 'thinking' ? Math.sin(t * 2.2) : 0);
    // FLARE: someone asked you something. Amber washes in fast, eases out over ~2s.
    const f = inp.flare ?? 0;
    if (f !== lastFlare) { lastFlare = f; flare = 1; startle = 1; }
    flare *= 0.965;
    u.uFlare.value = flare;
    u.uLean.value += ((reduceMotion ? k.lean * 0.4 : k.lean) - u.uLean.value) * 0.035;
    u.uSway.value += (k.sway - u.uSway.value) * 0.04;
    u.uWave.value += ((reduceMotion ? 0.3 : k.wave) - u.uWave.value) * 0.04;
    u.uGlow.value += (k.glow - u.uGlow.value) * 0.05;
    u.uLevel.value = reduceMotion ? 0 : smoothLevel;
    u.uStartle.value = reduceMotion ? 0 : startle;
    u.uEyesOpen.value += (Math.min(1, k.eyes + startle * 0.5 + flare * 0.4) - u.uEyesOpen.value) * 0.09;
    // Gaze: jarvis drift, pulled toward a recent pointer; while thinking, up and to the side.
    const th = inp.state === 'thinking' ? 1 : 0;
    const drift = reduceMotion ? 0 : 1;
    const dx = (Math.sin(t * 0.4) * 0.5 + Math.sin(t * 0.13) * 0.5) * drift + th * 0.6;
    const dy = Math.sin(t * 0.27 + 1.0) * 0.3 * drift - th * 0.9;
    const pw = th ? 0 : Math.max(0, 1 - (now - pointerAt) / 4000) * 0.75;
    gx += (dx * (1 - pw) + px * 1.6 * pw - gx) * 0.12;
    gy += (dy * (1 - pw) - py * 1.2 * pw - gy) * 0.12;
    u.uGazeX.value = gx;
    u.uGazeY.value = gy;
    targetColor.setHex(COLOR[inp.state]);
    u.uColor.value.lerp(targetColor, 0.05);

    // THINKING: a slow half-turn back and forth (reads as "considering"), otherwise a gentle idle turn.
    spin += ((reduceMotion ? 0 : k.spin) - spin) * 0.03;
    veil.rotation.y = Math.sin(t * 0.22) * 0.16 + Math.sin(t * 0.45) * 0.42 * spin + (reduceMotion ? 0 : px * 0.18 * (1 - spin));

    if (!reduceMotion && now >= nextBlink) { blinkStart = now; nextBlink = now + 6000 + Math.random() * 3000; }
    if (blinkStart >= 0) {
      const g = (now - blinkStart) / 340;
      u.uBlink.value = g >= 1 ? 0 : Math.sin(g * Math.PI);
      if (g >= 1) blinkStart = -1;
    }

    // MOUTH: real voice envelope when speaking; otherwise closed.
    let mouthTarget = 0;
    if (inp.state === 'speaking') {
      if (inp.envelope) {
        const i = Math.floor((now - inp.envelopeStart) / inp.envelopeStepMs);
        if (i >= 0 && i < inp.envelope.length) mouthTarget = inp.envelope[i];
      } else mouthTarget = Math.min(1, smoothLevel * 1.4); // no envelope: follow the live level
    }
    u.uMouth.value += (mouthTarget - u.uMouth.value) * 0.35;

    renderer.render(scene, camera);
  };

  const start = () => { if (running && !raf) raf = requestAnimationFrame(loop); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const onVisibility = () => { if (document.hidden) stop(); else start(); };
  document.addEventListener('visibilitychange', onVisibility);
  if (!document.hidden) start();

  return () => {
    running = false;
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPointer);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };
}
