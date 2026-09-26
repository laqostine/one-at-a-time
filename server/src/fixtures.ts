import { SPEAKER_COLORS, type LedgerItem, type Session, type Speaker, type TimelineItem } from '../../shared/types.ts';

export const me: Session['me'] = { name: 'Bera', aliases: ['Berra', 'B'] };

export const speakers: Record<number, Speaker> = {
  0: { id: 0, name: 'Alex', color: SPEAKER_COLORS[0] },
  1: { id: 1, name: 'Sam', color: SPEAKER_COLORS[1] },
  2: { id: 2, name: 'Priya', color: SPEAKER_COLORS[2] },
};

let n = 0;
const u = (speaker: number, sec: number, text: string, dur = 3): TimelineItem =>
  ({ id: `u${++n}`, type: 'utterance', speaker, text, tStart: sec * 1000, tEnd: (sec + dur) * 1000, final: true });

// ~90 s: decision forming, objection, joke + laughter, question to Bera.
export const timeline: TimelineItem[] = [
  u(0, 2, "Okay, so where are we on the live captions feature?"),
  u(2, 6, "The captions UI is done, speaker colors work on my phone."),
  u(0, 11, "Great. I think we ship captions Friday, to the beta group.", 4),
  u(2, 16, "Friday works for me, I can do the release notes."),
  u(1, 21, "I'm not sure. Diarization still flaps when two people talk over each other.", 5),
  u(1, 27, "I'd rather push to Monday and fix the speaker switching first.", 4),
  u(0, 32, "How bad is it though? Is it a blocker or just annoying?"),
  u(1, 36, "Annoying. It swapped Priya and me twice in yesterday's test.", 4),
  u(2, 41, "Honestly at this point we could ship it on a Nokia and nobody would notice.", 4),
  { id: 'e1', type: 'event', kind: 'laughter', t: 45_500, score: 0.82 },
  u(0, 49, "Ha. Okay, so Friday or Monday, we still need to decide."),
  u(2, 54, "Also, who's presenting at the demo? We need a script.", 3),
  u(0, 58, "Right. Do we have a fallback if the mic fails on stage?", 4),
  u(1, 64, "We have replay mode, that should cover it."),
  u(0, 70, "Good. Let's lean Friday unless Sam's fix lands late.", 4),
  u(1, 76, "Fine, but I want it in writing that Monday is the fallback.", 4),
  u(0, 84, "Bera, can you own the demo script?", 3),
];

export const existingLedger: LedgerItem[] = [
  { id: 'ledger-seed-0', kind: 'decision', text: 'Ship captions Friday to beta group', speaker: 'Alex', t: 11_000, resolved: false },
];

export const LAUGH_T = 45_500;
export const NOW_T = 90_000;
