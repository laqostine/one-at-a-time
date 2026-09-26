// Per-device display prefs (font size, contrast, synthetic voice). localStorage is a convenience only.
export type FontSize = 'S' | 'M' | 'L' | 'XL';
export const FONT_PX: Record<FontSize, number> = { S: 16, M: 18, L: 21, XL: 24 };
/** voice: "Also say it aloud (synthetic voice)" for Speak for me. Default OFF: text-first on phones. */
export interface Prefs { font: FontSize; contrast: boolean; voice: boolean }

const VOICE_KEY = 'imt.voice';

function loadVoice(): boolean {
  try { return localStorage.getItem(VOICE_KEY) === '1'; } catch { return false; }
}

export function loadPrefs(): Prefs {
  const voice = loadVoice();
  try {
    const v = JSON.parse(localStorage.getItem('imt.prefs') ?? 'null');
    if (v && v.font in FONT_PX) return { font: v.font, contrast: !!v.contrast, voice };
  } catch { /* ignore */ }
  return { font: 'M', contrast: false, voice };
}
export function applyPrefs(p: Prefs) {
  const root = document.documentElement;
  root.style.fontSize = `${FONT_PX[p.font]}px`;
  if (p.contrast) root.dataset.contrast = 'high'; else delete root.dataset.contrast;
  try {
    localStorage.setItem('imt.prefs', JSON.stringify({ font: p.font, contrast: p.contrast }));
    localStorage.setItem(VOICE_KEY, p.voice ? '1' : '0');
  } catch { /* ignore */ }
}
