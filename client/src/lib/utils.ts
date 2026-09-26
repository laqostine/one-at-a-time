import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Speaker colors are saturated mid-tones (good for borders/dots). For *text* on the dark card,
 * lift them toward white so every palette entry clears WCAG AA (>= 4.5:1).
 */
export function readable(color: string): string {
  return color ? `color-mix(in oklab, ${color} 70%, white)` : 'var(--fg)';
}
