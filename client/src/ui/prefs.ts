// Per-device display prefs (font size, contrast, synthetic voice, captions). localStorage is a convenience only.
export type FontSize = 'S' | 'M' | 'L' | 'XL';
export const FONT_PX: Record<FontSize, number> = { S: 16, M: 17, L: 20, XL: 23 };
/** voice: "Also say it aloud" for Say something (default OFF: text-first). captions: the full caption list (default OFF). */
/** clerkSpeaks: "The clerk speaks for me" (voice on the table's phones, default OFF); clerkVoice: speechSynthesis voice name. */
export interface Prefs { font: FontSize; contrast: boolean; voice: boolean; captions: boolean; clerkSpeaks: boolean; clerkVoice: string }

const VOICE_KEY = 'imt.voice';
const CLERK_KEY = 'imt.clerkSpeaks';
const CLERK_VOICE_KEY = 'imt.clerkVoice';

function get(k: string): string {
  try { return localStorage.getItem(k) ?? ''; } catch { return ''; }
}

function loadVoice(): boolean {
  try { return localStorage.getItem(VOICE_KEY) === '1'; } catch { return false; }
}

export function loadPrefs(): Prefs {
  const voice = loadVoice();
  const clerk = { clerkSpeaks: get(CLERK_KEY) === '1', clerkVoice: get(CLERK_VOICE_KEY) };
  try {
    const v = JSON.parse(localStorage.getItem('imt.prefs') ?? 'null');
    if (v && v.font in FONT_PX) return { font: v.font, contrast: !!v.contrast, voice, captions: !!v.captions, ...clerk };
  } catch { /* ignore */ }
  return { font: 'M', contrast: false, voice, captions: false, ...clerk };
}
export function applyPrefs(p: Prefs) {
  const root = document.documentElement;
  root.style.fontSize = `${FONT_PX[p.font]}px`;
  if (p.contrast) root.dataset.contrast = 'high'; else delete root.dataset.contrast;
  try {
    localStorage.setItem('imt.prefs', JSON.stringify({ font: p.font, contrast: p.contrast, captions: p.captions }));
    localStorage.setItem(VOICE_KEY, p.voice ? '1' : '0');
    localStorage.setItem(CLERK_KEY, p.clerkSpeaks ? '1' : '0');
    localStorage.setItem(CLERK_VOICE_KEY, p.clerkVoice);
  } catch { /* ignore */ }
}
