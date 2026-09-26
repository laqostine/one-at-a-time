// three.js scene for Presence3D — kept in its own module so `three` is only pulled in via
// dynamic import (lazy chunk). Ported from the jarvis project's `Varlik3D`
// (~/.claude/jarvis/web/Varlik3D.tsx): a floating silk "veil" with a head, glowing eyes and a
// mouth. It leans toward you while listening, sways while thinking, ripples with sound
// while speaking and straightens up the moment you start talking.
import * as THREE from 'three';
import type { PresenceState } from './Presence';

export const COLOR: Record<PresenceState, number> = {
  idle: 0x6b7280,
  listening: 0x60a5fa,
  transcribing: 0xfbbf24,
  thinking: 0xa78bfa,
  speaking: 0x34d399,
};

// Posture vocabulary: lean (toward you), sway (side to side), wave (cloth motion),
// glow (inner light), eyes (openness — sleepy / wide / narrowed).
const CHARACTER: Record<PresenceState, { lean: number; sway: number; wave: number; glow: number; eyes: number }> = {
  idle:         { lean: 0.00, sway: 0.35, wave: 0.45, glow: 0.45, eyes: 0.30 }, // sleepy
  listening:    { lean: 1.00, sway: 0.15, wave: 0.55, glow: 0.75, eyes: 1.00 }, // wide open
  transcribing: { lean: 0.35, sway: 0.60, wave: 1.30, glow: 0.80, eyes: 0.70 },
  thinking:     { lean: 0.15, sway: 1.00, wave: 0.80, glow: 0.85, eyes: 0.45 }, // narrowed
  speaking:     { lean: 0.55, sway: 0.30, wave: 1.00, glow: 1.00, eyes: 0.80 },
};

const VERTEX = `
uniform float uTime, uLean, uSway, uWave, uLevel, uStartle, uMouth;
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

  // BREATH: slow swell
  p *= 1.0 + 0.022 * sin(uTime * 0.55);

  // SPEAKING BODY: chest puffs forward-up with the voice, plus a fine shimmer.
  p.z += uMouth * 0.05 * pow(1.0 - v, 1.5);
  p += n * uMouth * 0.018 * sin(v * 22.0 - uTime * 9.0) * weight;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = -mv.xyz;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = `
uniform vec3 uColor; uniform float uGlow, uTime, uBlink, uEyesOpen, uGazeX, uGazeY, uMouth;
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

  // Milky veil: soft body, edges (fresnel) glow.
  float rim = pow(1.0 - abs(dot(N, V)), 2.2);
  vec3 milk = vec3(0.92, 0.88, 0.84);

  // INNER LIGHT: state color at chest height — lit from inside, not painted on.
  float chest = exp(-pow((v - 0.32) * 3.4, 2.0));
  vec3 col = milk * (0.16 + rim * 0.55) + uColor * chest * 0.85 * uGlow + uColor * rim * 0.25;

  // EYES — on the front (u=0.25 faces the camera), on the head dome.
  {
    float open = uEyesOpen * (1.0 - uBlink);
    vec2 gaze = vec2(uGazeX * 0.016, uGazeY * 0.012);
    float g1 = eye(vUV, vec2(0.25 - 0.055, 0.145) + gaze, open);
    float g2 = eye(vUV, vec2(0.25 + 0.055, 0.145) + gaze, open);
    float gz = max(g1, g2);
    col = mix(col, vec3(1.0, 0.97, 0.9), gz * 0.9);
    col += uColor * gz * 0.35;
    alphaAdd = gz * 0.9;

    // MOUTH: under the eyes; fixed width, height follows the voice envelope.
    vec2 am = vUV - vec2(0.25, 0.215);
    float ay = max(0.005 + 0.034 * uMouth, 0.004);
    float ae = pow(am.x / 0.026, 2.0) + pow(am.y / ay, 2.0);
    float mouth = smoothstep(1.0, 0.45, ae);
    col = mix(col, vec3(1.0, 0.93, 0.82), mouth * 0.85);
    col += uColor * mouth * 0.3;
    alphaAdd += mouth * 0.85;
  }

  // Translucency: the hem dissolves into the air, the top starts soft.
  float alpha = 0.34 + rim * 0.5 + chest * 0.28 * uGlow + alphaAdd;
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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
    uColor: { value: new THREE.Color(COLOR[read().state]) },
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
    u.uLean.value += ((reduceMotion ? k.lean * 0.4 : k.lean) - u.uLean.value) * 0.035;
    u.uSway.value += (k.sway - u.uSway.value) * 0.04;
    u.uWave.value += ((reduceMotion ? 0.3 : k.wave) - u.uWave.value) * 0.04;
    u.uGlow.value += (k.glow - u.uGlow.value) * 0.05;
    u.uLevel.value = reduceMotion ? 0 : smoothLevel;
    u.uStartle.value = reduceMotion ? 0 : startle;
    u.uEyesOpen.value += (Math.min(1, k.eyes + startle * 0.5) - u.uEyesOpen.value) * 0.09;
    // Gaze wander; while thinking, up and to the side (the classic "thinking" look).
    const th = inp.state === 'thinking' ? 1 : 0;
    u.uGazeX.value = Math.sin(t * 0.4) * 0.5 + Math.sin(t * 0.13) * 0.5 + th * 0.6;
    u.uGazeY.value = Math.sin(t * 0.27 + 1.0) * 0.3 - th * 0.9;
    targetColor.setHex(COLOR[inp.state]);
    u.uColor.value.lerp(targetColor, 0.05);

    veil.rotation.y = Math.sin(t * 0.22) * 0.16;

    if (!reduceMotion && now >= nextBlink) { blinkStart = now; nextBlink = now + 6000 + Math.random() * 3000; }
    if (blinkStart >= 0) {
      const g = (now - blinkStart) / 340;
      u.uBlink.value = g >= 1 ? 0 : Math.sin(g * Math.PI);
      if (g >= 1) blinkStart = -1;
    }

    // MOUTH: real voice envelope when speaking; otherwise closed.
    let mouthTarget = 0;
    if (inp.state === 'speaking' && inp.envelope) {
      const i = Math.floor((now - inp.envelopeStart) / inp.envelopeStepMs);
      if (i >= 0 && i < inp.envelope.length) mouthTarget = inp.envelope[i];
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
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };
}
