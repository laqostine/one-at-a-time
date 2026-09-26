// The table lamp on the host: mirrors the phones' lamp mode for the whole table.
// green = one at a time, amber = two talking at once (or a bit fast), red = too fast.
// Uses the server's table message when phones are joined; otherwise just "someone has the floor" / quiet.
export type LampTone = 'good' | 'amber' | 'red' | 'quiet';

export interface TableLampState { tone: LampTone; word: string; hint: string; hex: string }

const HEX: Record<LampTone, string> = { good: 'var(--lamp-good)', amber: 'var(--lamp-amber)', red: 'var(--lamp-red)', quiet: 'var(--lamp-light)' };

export function tableLamp(table: { overlap: boolean; avgWpm: number } | null, someoneTalking: boolean): TableLampState {
  if (table?.overlap) return { tone: 'amber', word: 'Two talking', hint: 'Phones glow amber: one at a time', hex: HEX.amber };
  if (table && table.avgWpm >= 170) return { tone: 'red', word: 'Too fast', hint: 'Phones glow red: slow down', hex: HEX.red };
  if (table && table.avgWpm >= 150) return { tone: 'amber', word: 'A bit fast', hint: 'Phones glow amber: a little slower', hex: HEX.amber };
  if (someoneTalking) return { tone: 'good', word: 'One at a time', hint: 'Phones glow green', hex: HEX.good };
  return { tone: 'quiet', word: 'Quiet table', hint: 'Nobody is talking', hex: HEX.quiet };
}
