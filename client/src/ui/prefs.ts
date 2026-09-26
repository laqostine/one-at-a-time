// Per-device display prefs (font size, contrast). localStorage is a convenience only.
export type FontSize = 'S' | 'M' | 'L' | 'XL';
export const FONT_PX: Record<FontSize, number> = { S: 16, M: 18, L: 21, XL: 24 };
export interface Prefs { font: FontSize; contrast: boolean }

export function loadPrefs(): Prefs {
  try {
    const v = JSON.parse(localStorage.getItem('imt.prefs') ?? 'null');
    if (v && v.font in FONT_PX) return { font: v.font, contrast: !!v.contrast };
  } catch { /* ignore */ }
  return { font: 'M', contrast: false };
}
export function applyPrefs(p: Prefs) {
  const root = document.documentElement;
  root.style.fontSize = `${FONT_PX[p.font]}px`;
  if (p.contrast) root.dataset.contrast = 'high'; else delete root.dataset.contrast;
  try { localStorage.setItem('imt.prefs', JSON.stringify(p)); } catch { /* ignore */ }
}
