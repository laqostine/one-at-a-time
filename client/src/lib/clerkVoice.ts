// The clerk's voice on the table's phones (speechSynthesis). One consistent voice per table:
// the listener may pick one by name; otherwise a female voice for the table language
// (tr-TR / it-IT / en-GB) when the device has one. Default table is silent: callers gate on tableVoiceOn().

export type TableLang = 'en' | 'it' | 'tr' | 'multi' | string;

const FEMALE = /female|samantha|karen|kate|serena|moira|tessa|fiona|victoria|susan|alice|federica|paola|elsa|yelda|seda|filiz|zira|hazel|libby|sonia|emma|amy|google uk english female/i;
const LOCALE: Record<string, string> = { en: 'en-GB', it: 'it-IT', tr: 'tr-TR' };
const PHRASE: Record<string, string> = { en: 'One at a time', it: 'Uno alla volta', tr: 'Sırayla lütfen' };

export const hasSpeech = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function listVoices(): SpeechSynthesisVoice[] {
  try { return hasSpeech() ? window.speechSynthesis.getVoices() : []; } catch { return []; }
}

/** Voices matching a table language (all voices for 'multi'), best first. */
export function voicesFor(lang: TableLang): SpeechSynthesisVoice[] {
  const all = listVoices();
  const code = lang === 'multi' ? '' : (lang || 'en').slice(0, 2).toLowerCase();
  const loc = LOCALE[code]?.toLowerCase();
  const list = code ? all.filter((v) => v.lang.toLowerCase().startsWith(code)) : all.slice();
  const score = (v: SpeechSynthesisVoice) => (loc && v.lang.toLowerCase().replace('_', '-') === loc ? 2 : 0) + (FEMALE.test(v.name) ? 1 : 0);
  return list.sort((a, b) => score(b) - score(a));
}

export function pickVoice(lang: TableLang, preferred?: string): SpeechSynthesisVoice | null {
  const all = listVoices();
  if (preferred) { const v = all.find((x) => x.name === preferred); if (v) return v; }
  return voicesFor(lang)[0] ?? null;
}

export function speakLine(text: string, opts: { lang: TableLang; voice?: string; volume?: number }): void {
  if (!hasSpeech() || !text.trim()) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(opts.lang, opts.voice);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = LOCALE[(opts.lang || 'en').slice(0, 2)] ?? 'en-GB';
    u.rate = 0.95;
    u.volume = opts.volume ?? 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* unsupported */ }
}

export const oneAtATime = (lang: TableLang): string => PHRASE[(lang || 'en').slice(0, 2)] ?? PHRASE.en;

/** iOS/Safari only speak after a gesture: call from a click handler once. */
export function primeSpeech(): void {
  if (!hasSpeech()) return;
  try { const u = new SpeechSynthesisUtterance(''); u.volume = 0; window.speechSynthesis.speak(u); } catch { /* ignore */ }
}

// Join-page storage: the host's link carries voice=1|0 and clerkVoice=<name>.
const TV = 'imt.tableVoice';
const CV = 'imt.clerkVoice';
export function adoptTableVoiceParams(q: URLSearchParams): void {
  try {
    const v = q.get('voice');
    if (v === '1' || v === '0') localStorage.setItem(TV, v);
    const n = q.get('clerkVoice');
    if (n != null) localStorage.setItem(CV, n);
  } catch { /* ignore */ }
}
export function tableVoiceOn(): boolean {
  try { return localStorage.getItem(TV) === '1'; } catch { return false; }
}
export function tableVoiceName(): string {
  try { return localStorage.getItem(CV) ?? ''; } catch { return ''; }
}
