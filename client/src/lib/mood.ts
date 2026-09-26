// Mood: the prosody a hearing person reads off the room, folded from the gate's per-line tone.
import type { Tone, Utterance } from '../../../shared/types';

export type TableMood = 'warm' | 'tense' | 'light' | 'quiet';
export type SpeakerMood = Tone | 'neutral';

/** Majority of a speaker's last 6 non-neutral tones (ties go to the most recent). */
export function speakerMood(tones: (Tone | undefined)[]): SpeakerMood {
  const last = tones.filter((t): t is Tone => !!t && t !== 'neutral').slice(-6);
  if (!last.length) return 'neutral';
  const n = new Map<Tone, number>();
  for (const t of last) n.set(t, (n.get(t) ?? 0) + 1);
  let best: Tone = last[last.length - 1], bestN = 0;
  for (let k = last.length - 1; k >= 0; k--) { const c = n.get(last[k])!; if (c > bestN) { best = last[k]; bestN = c; } }
  return best;
}

/** Table mood over the last 10 final lines: light > tense > warm > quiet. */
export function tableMood(recent: Pick<Utterance, 'tone' | 'final'>[]): TableMood {
  const tones = recent.filter((u) => u.final !== false).slice(-10).map((u) => u.tone);
  const count = (...ks: Tone[]) => tones.filter((t) => t && ks.includes(t)).length;
  if (count('teasing', 'excited') >= 2) return 'light';
  if (count('annoyed', 'urgent') >= 2) return 'tense';
  if (count('warm') >= 2) return 'warm';
  return 'quiet';
}

/** Ring color on the map for a speaker mood (null = no ring). */
export function moodRing(m: SpeakerMood): string | null {
  if (m === 'warm') return 'var(--amber)';
  if (m === 'annoyed' || m === 'urgent') return '#B4432F';
  if (m === 'teasing' || m === 'excited') return '#4F8A5B';
  return null;
}
