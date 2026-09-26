// 3D voice-reactive presence (lazy three.js chunk). Same props as the 2D `Presence`, plus an
// optional speaking `envelope` (amplitude samples, one per `envelopeStepMs`, starting when the
// array identity changes). Falls back to the 2D Presence if WebGL is missing or init fails.
import { useEffect, useRef, useState } from 'react';
import { Presence, type PresenceState } from './Presence';
import type { SceneInputs } from './presence3dScene';
import { PresenceHalo } from './PresenceHalo';

const LABEL: Record<PresenceState, string> = {
  idle: 'waiting',
  listening: 'listening',
  transcribing: 'writing',
  thinking: 'thinking',
  speaking: 'speaking',
};

let webglCache: boolean | null = null;
/** True if the browser can create a WebGL context (so callers can fall back to 2D). */
export function hasWebGL(): boolean {
  if (webglCache != null) return webglCache;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    webglCache = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglCache = false;
  }
  return webglCache;
}

export function Presence3D({ state, level, size = 96, envelope, envelopeStepMs = 20, flare = 0, halo = true }: {
  state: PresenceState;
  level: number;
  size?: number;
  envelope?: Float32Array;
  envelopeStepMs?: number;
  /** Increment to fire a brief amber "addressed to you" flare. */
  flare?: number;
  /** Soft radial glow behind the figure, tinted by state. */
  halo?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(() => !hasWebGL());
  const inputs = useRef<SceneInputs>({ state, level, envelope, envelopeStart: 0, envelopeStepMs, flare });
  if (inputs.current.envelope !== envelope) inputs.current.envelopeStart = performance.now();
  Object.assign(inputs.current, { state, level, envelope, envelopeStepMs, flare });

  useEffect(() => {
    const el = hostRef.current;
    if (!el || failed) return;
    let dispose: (() => void) | null = null;
    let cancelled = false;
    import('./presence3dScene')
      .then((m) => {
        if (cancelled) return;
        dispose = m.mountPresenceScene(el, size, () => inputs.current);
        if (!dispose) setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; dispose?.(); };
  }, [size, failed]);

  if (failed) {
    return (
      <div className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
        {halo && <PresenceHalo state={state} flare={flare} />}
        <div className="relative"><Presence state={state} level={level} size={size} /></div>
      </div>
    );
  }
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      {halo && <PresenceHalo state={state} flare={flare} />}
      <div ref={hostRef} className="relative" style={{ width: '100%', height: '100%' }} />
      {/* not a live region: the header status line already announces changes; this would chatter */}
      <span className="sr-only">Presence: {LABEL[state]}</span>
    </div>
  );
}
