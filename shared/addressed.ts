// Fast-path "addressed to me" detector: fuzzy name hit AND question shape. Pure, no LLM. Shared by client (instant nudge) and server (/api/gate fallback).
import type { Session } from './types.ts';

const QUESTION_STARTS = ['what', 'can', 'could', 'do', 'did', 'would', 'should', 'are', 'is', 'have', 'will', 'you', 'hey'];

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

const words = (t: string): string[] => t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9']+/g) ?? [];

/** Does a single spoken word plausibly refer to `name` (ASR-tolerant)? */
export function wordMatchesName(word: string, name: string): boolean {
  const w = word.replace(/'s$/, ''), n = name.toLowerCase();
  if (!w || !n) return false;
  if (w === n) return true;
  if (n.length >= 4 && w.length >= 4 && w.slice(0, 4) === n.slice(0, 4)) return true;
  return n.length >= 3 && Math.abs(w.length - n.length) <= 1 && levenshtein(w, n) <= 1;
}

export function mentionsMe(text: string, me: Session['me']): boolean {
  const names = [me.name, ...me.aliases].flatMap((n) => words(n)).filter((n) => n.length >= 2);
  if (!names.length) return false;
  return words(text).some((w) => names.some((n) => wordMatchesName(w, n)));
}

export function isQuestionShape(text: string, me?: Session['me']): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\?\s*["')\]]*$/.test(t)) return true;
  // Check each sentence start, also after a leading vocative ("Bera, can you…").
  const sentences = t.split(/[.!;]\s+/);
  return sentences.some((sent) => {
    let ws: string[] = words(sent);
    const head = ws[0];
    if (me && head && ws.length > 1 && mentionsMe(head, me)) ws = ws.slice(1);
    const first = ws[0];
    return !!first && QUESTION_STARTS.includes(first);
  });
}

export function isAddressedToMe(text: string, me: Session['me']): boolean {
  return mentionsMe(text, me) && isQuestionShape(text, me);
}
