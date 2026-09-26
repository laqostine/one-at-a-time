// Low-confidence ("doubt") words from per-word ASR confidence. Pure helpers, no React.
import type { Utterance } from '../../../shared/types';

export const DOUBT_THRESHOLD = 0.6;

/** A run of adjacent low-confidence words. from/to are WORD indices into utt.words (to exclusive). */
export interface DoubtSpan { text: string; from: number; to: number }

/** Merged runs of adjacent words with c < threshold. [] when the utterance has no word confidences. */
export function lowConfidenceSpans(utt: Pick<Utterance, 'words'>, threshold = DOUBT_THRESHOLD): DoubtSpan[] {
  const words = utt.words ?? [];
  const out: DoubtSpan[] = [];
  let from = -1;
  const flush = (to: number) => {
    if (from < 0) return;
    out.push({ text: words.slice(from, to).map((x) => x.w).join(' '), from, to });
    from = -1;
  };
  words.forEach((x, i) => {
    if (x.c < threshold) { if (from < 0) from = i; }
    else flush(i);
  });
  flush(words.length);
  return out;
}

export const hasDoubt = (utt: Pick<Utterance, 'words'>, threshold = DOUBT_THRESHOLD) =>
  (utt.words ?? []).some((x) => x.c < threshold);

/** Render-ready segments covering the whole line: [{text, low}] (falls back to one segment of utt.text). */
export function wordSegments(utt: Pick<Utterance, 'words' | 'text'>, threshold = DOUBT_THRESHOLD): { text: string; low: boolean }[] {
  const words = utt.words ?? [];
  if (!words.length) return [{ text: utt.text, low: false }];
  const segs: { text: string; low: boolean }[] = [];
  for (const x of words) {
    const low = x.c < threshold;
    const last = segs[segs.length - 1];
    if (last && last.low === low) last.text += ` ${x.w}`;
    else segs.push({ text: segs.length ? ` ${x.w}` : x.w, low });
  }
  // keep the joining space outside low segments so underline/grey doesn't start on a space
  return segs.flatMap((sg) => (sg.low && sg.text.startsWith(' ') ? [{ text: ' ', low: false }, { text: sg.text.slice(1), low: true }] : [sg]));
}
