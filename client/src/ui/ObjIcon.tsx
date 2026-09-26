// Illustrated table objects: /icons/a/<name>.png are the Gemini renders with the black background
// turned into real transparency (alpha from luminance), so they sit cleanly on wood, linen or cards.
// If a PNG is missing or fails, the matching line icon from icons.tsx is drawn instead.
import { useState } from 'react';
import type { IconType } from './icons';
import { cn } from '@/lib/utils';

export type ObjName = 'mug' | 'lamp' | 'chair' | 'placemat' | 'plate' | 'phone' | 'table' | 'bell' | 'note' | 'popper' | 'eraser' | 'card' | 'hand';

export function ObjIcon({ name, fallback: Fallback, size = 48, className }: {
  name: ObjName; fallback: IconType; size?: number; className?: string; blend?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  if (broken) return <Fallback size={Math.round(size * 0.7)} className={className} />;
  return (
    <img src={`/icons/a/${name}.png`} alt="" aria-hidden width={size} height={size} draggable={false}
      onError={() => setBroken(true)}
      className={cn('shrink-0 scale-[1.22] select-none object-contain drop-shadow-[0_4px_6px_rgb(0_0_0/.45)]', className)}
      style={{ width: size, height: size }} />
  );
}
