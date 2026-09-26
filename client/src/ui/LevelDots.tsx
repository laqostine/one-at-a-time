// Dotted "listening" waveform: a strip of dot columns scrolling left, each column lit by the
// mic level at that moment. Reads as "it hears the room" without being a spectrum toy.
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const COLS = 32;
const ROWS = 5;
const STEP_MS = 90;

export function LevelDots({ level, active, color = 'var(--accent)', className }: { level: number; active: boolean; color?: string; className?: string }) {
  const lv = useRef(level);
  lv.current = level;
  const [hist, setHist] = useState<number[]>(() => Array(COLS).fill(0));
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setHist((h) => {
        const jitter = active ? 0.08 + Math.random() * 0.1 : 0;
        const v = active ? Math.min(1, lv.current * (0.75 + Math.random() * 0.5) + jitter) : 0;
        return [...h.slice(1), v];
      });
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [active]);

  return (
    <div aria-hidden className={cn('flex h-[26px] items-center justify-center gap-[3px]', className)}>
      {hist.map((v, i) => {
        const lit = Math.round(v * ROWS);
        return (
          <span key={i} className="flex flex-col items-center justify-center gap-[2px]">
            {Array.from({ length: ROWS }, (_, r) => {
              const d = Math.abs(r - (ROWS - 1) / 2); // symmetric around the middle row
              const on = d * 2 < lit || (r === (ROWS - 1) / 2 && active);
              return <span key={r} className="size-[3px] rounded-full transition-opacity duration-150"
                style={{ background: color, opacity: on ? 0.3 + 0.7 * (i / (COLS - 1)) : 0.12 }} />;
            })}
          </span>
        );
      })}
    </div>
  );
}
