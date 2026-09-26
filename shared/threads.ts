// Thread-label normalization shared by server (id assignment) and client (catch-up bullet -> lane).
// Pure, no deps. Labels are fuzzy: "Friday launch" / "the friday launch!" / "launch friday" => one lane.
import type { Thread } from './types.ts';

const STOP = new Set(['the', 'a', 'an', 'of', 'on', 'for', 'to', 'and', 'about', 're', 'with', 'in']);

/** lowercase, strip punctuation, collapse spaces. */
export const normalizeLabel = (label: string) =>
  label.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

export const labelTokens = (label: string) => {
  const all = normalizeLabel(label).split(' ').filter(Boolean);
  const content = all.filter((w) => !STOP.has(w));
  return new Set(content.length ? content : all);
};

export function labelJaccard(a: string, b: string): number {
  const A = labelTokens(a), B = labelTokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export const THREAD_MERGE_JACCARD = 0.5;

/** Best existing thread whose label matches (exact normalized, else token Jaccard >= 0.5). */
export function matchThread(label: string | undefined, threads: Pick<Thread, 'id' | 'label'>[]): string | undefined {
  if (!label || !normalizeLabel(label)) return undefined;
  const n = normalizeLabel(label);
  const exact = threads.find((t) => normalizeLabel(t.label) === n || t.id === label);
  if (exact) return exact.id;
  let best: string | undefined, bestJ = 0;
  for (const t of threads) {
    const j = labelJaccard(label, t.label);
    if (j >= THREAD_MERGE_JACCARD && j > bestJ) { best = t.id; bestJ = j; }
  }
  return best;
}

/** Stable id for a brand-new label: "th-friday-launch". */
export const threadSlug = (label: string) =>
  `th-${normalizeLabel(label).replace(/ /g, '-').slice(0, 40) || 'general'}`;
