// Illustrated table objects (/icons/<name>.png: warm ceramic/wood renders on pure black).
// Rendered with mix-blend-mode: screen so the black drops out on our dark surfaces.
// If the PNG is missing or fails, the matching line icon from icons.tsx is drawn instead.
import { useState } from 'react';
import type { IconType } from './icons';
import { cn } from '@/lib/utils';

export type ObjName = 'mug' | 'lamp' | 'chair' | 'placemat' | 'plate' | 'phone' | 'table' | 'bell' | 'note' | 'popper' | 'eraser' | 'card' | 'hand';

export function ObjIcon({ name, fallback: Fallback, size = 32, className, blend = true }: {
  name: ObjName; fallback: IconType; size?: number; className?: string; blend?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  if (broken) return <Fallback size={Math.round(size * 0.72)} className={className} />;
  return (
    <img src={`/icons/${name}.png`} alt="" aria-hidden width={size} height={size} draggable={false} loading="lazy"
      onError={() => setBroken(true)}
      className={cn('shrink-0 select-none object-contain', blend && 'mix-blend-screen', className)}
      style={{ width: size, height: size }} />
  );
}
