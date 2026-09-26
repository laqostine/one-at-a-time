// Listening-indicator mascot, ported from the jarvis project's `Varlik` component
// (~/.claude/jarvis/web/Varlik.tsx): one canvas, one core + up to 3 rings, driven by
// state + mic RMS level. The point isn't decoration — it's a single glance telling
// you what the assistant is doing right now.
import { useEffect, useRef } from 'react';

export type PresenceState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

const COLOR: Record<PresenceState, string> = {
  idle: '#6B7280', // gray-500
  listening: '#60A5FA', // blue-400
  transcribing: '#FBBF24', // amber-400
  thinking: '#A78BFA', // violet-400
  speaking: '#34D399', // emerald-400
};

const LABEL: Record<PresenceState, string> = {
  idle: 'waiting',
  listening: 'listening',
  transcribing: 'writing',
  thinking: 'thinking',
  speaking: 'speaking',
};

export function Presence({ state, level, size = 96 }: { state: PresenceState; level: number; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const levelRef = useRef(level);
  stateRef.current = state;
  levelRef.current = level;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let running = true;
    let phase = 0;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const draw = () => {
      if (!running) return;
      const dpr = window.devicePixelRatio || 1;
      const w = (c.width = c.clientWidth * dpr);
      const h = (c.height = c.clientHeight * dpr);
      const cx = w / 2, cy = h / 2;
      const base = Math.min(w, h) * 0.22;
      const s = stateRef.current;
      const color = COLOR[s];

      ctx.clearRect(0, 0, w, h);
      phase += reduceMotion ? 0 : s === 'thinking' ? 0.055 : s === 'speaking' ? 0.09 : 0.018;

      // Outer rings carry state intensity; idle gets one faint ring, everything else three.
      const ringCount = s === 'idle' ? 1 : 3;
      for (let i = 0; i < ringCount; i++) {
        const delay = i * 0.7;
        const pulse = reduceMotion ? 0.5 : (Math.sin(phase - delay) + 1) / 2;
        const live = s === 'speaking' ? levelRef.current * 2.2 : s === 'listening' ? levelRef.current * 1.6 : 0;
        const r = base * (1 + i * 0.42 + pulse * 0.14 + live);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = (0.42 - i * 0.11) * (s === 'idle' ? 0.5 : 1);
        ctx.lineWidth = (i === 0 ? 2 : 1) * dpr;
        ctx.stroke();
      }

      // Core
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, base * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = s === 'idle' ? 0.35 : 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;

      requestAnimationFrame(draw);
    };
    draw();
    return () => { running = false; };
  }, []);

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} aria-hidden style={{ width: '100%', height: '100%', display: 'block' }} />
      <span className="sr-only" role="status" aria-live="polite">{LABEL[state]}</span>
    </div>
  );
}
