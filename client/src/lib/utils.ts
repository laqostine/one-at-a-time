import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Speaker colors are saturated mid-tones (good for borders/dots). For *text*, mix them toward the
 * material's text color (white on walnut, ink on linen/paper) so every palette entry clears WCAG AA (>= 4.5:1).
 */
export function readable(color: string): string {
  // --spk-mix / --spk-to come from the material: toward white on the walnut, toward ink on linen/paper.
  return color ? `color-mix(in oklab, ${color} var(--spk-mix, 70%), var(--spk-to, white))` : 'var(--fg)';
}
