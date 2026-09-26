// "I Missed That" icon set: one hand, one grid. 24px grid, 1.75 stroke, round caps/joins, no fills
// except small "seat" dots. These name OUR concepts (the ledger kinds, lanes, pace, doubt words);
// lucide stays for generic chrome only (settings, close, chevrons, play/pause).
import type { ReactNode, SVGProps } from 'react';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> { size?: number; strokeWidth?: number; title?: string }
export type IconType = (p: IconProps) => ReactNode;

function make(name: string, body: ReactNode): IconType {
  const C = ({ size = 24, strokeWidth = 1.75, title, className, ...rest }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}
      aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} data-icon={name} {...rest}>
      {title && <title>{title}</title>}
      {body}
    </svg>
  );
  C.displayName = name;
  return C;
}
const Dot = ({ cx, cy, r = 1.35 }: { cx: number; cy: number; r?: number }) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;

/** Decision: a seal with a check and two ribbons: "this is settled". */
export const IconDecision = make('decision', <>
  <circle cx="12" cy="9.5" r="6" />
  <path d="m9.4 9.6 1.8 1.8 3.5-3.6" />
  <path d="M8.8 14.6 7.5 20.5l4.5-1.8 4.5 1.8-1.3-5.9" />
</>);

/** Objection: a speech bubble with a "!". */
export const IconObjection = make('objection', <>
  <path d="M6 4.5h12A2.5 2.5 0 0 1 20.5 7v7.5A2.5 2.5 0 0 1 18 17h-6.5L7 20.5V17H6a2.5 2.5 0 0 1-2.5-2.5V7A2.5 2.5 0 0 1 6 4.5Z" />
  <path d="M12 8v3.8" /><Dot cx={12} cy={14.4} />
</>);

/** Open question: a round bubble with a "?". */
export const IconQuestion = make('question', <>
  <path d="M12 3.5a8.25 8.25 0 0 0-7.2 12.3L3.7 20.3l4.5-1.1A8.25 8.25 0 1 0 12 3.5Z" />
  <path d="M9.7 9.6a2.4 2.4 0 1 1 3.4 2.2c-.7.3-1.1.8-1.1 1.5v.3" /><Dot cx={12} cy={16.2} />
</>);

/** For you: a person inside focus brackets: "this was aimed at you". */
export const IconForYou = make('for-you', <>
  <circle cx="12" cy="9.3" r="2.8" />
  <path d="M7 17.5a5 5 0 0 1 10 0" />
  <path d="M3.5 7.5V5A1.5 1.5 0 0 1 5 3.5h2.5M16.5 3.5H19A1.5 1.5 0 0 1 20.5 5v2.5M20.5 16.5V19a1.5 1.5 0 0 1-1.5 1.5h-2.5M7.5 20.5H5A1.5 1.5 0 0 1 3.5 19v-2.5" />
</>);

/** Changed: an instruction swapped for another. */
export const IconChanged = make('changed', <>
  <path d="M4 8.5h13.5M14 5l3.5 3.5L14 12" />
  <path d="M20 15.5H6.5M10 12l-3.5 3.5L10 19" />
</>);

/** Thread / lane: parallel conversations at one table. */
export const IconThread = make('thread', <>
  <path d="M7 3.5v17M17 3.5v17" />
  <Dot cx={7} cy={8} r={1.9} /><Dot cx={17} cy={12.5} r={1.9} /><Dot cx={7} cy={17} r={1.9} />
</>);

/** Reply to: a hooked arrow, "answering someone". */
export const IconReplyTo = make('reply-to', <>
  <path d="M5 4.5v6a4 4 0 0 0 4 4h10" />
  <path d="m15.5 11 3.5 3.5-3.5 3.5" />
</>);

/** Pace: a gauge whose needle leans toward "too fast". */
export const IconPace = make('pace', <>
  <path d="M3.8 17a8.2 8.2 0 1 1 16.4 0" />
  <path d="M12 17l4.2-5.2" /><Dot cx={12} cy={17} r={1.5} />
  <path d="M12 8.8v1.2M7.2 10.9l.9.8M16.8 10.9l-.9.8" />
</>);

/** Overlap: two voices talking over each other. */
export const IconOverlap = make('overlap', <>
  <circle cx="9" cy="10.5" r="5.5" />
  <circle cx="15" cy="13.5" r="5.5" />
</>);

/** Away: an eye whose gaze has drifted off the table. */
export const IconAway = make('away', <>
  <path d="M2.8 12S6.2 6.5 12 6.5 21.2 12 21.2 12 17.8 17.5 12 17.5 2.8 12 2.8 12Z" />
  <circle cx="15.2" cy="11" r="2.2" />
</>);

/** Speak for me: a bubble that carries a voice. */
export const IconSpeakForMe = make('speak-for-me', <>
  <path d="M6 4.5h12A2.5 2.5 0 0 1 20.5 7v7.5A2.5 2.5 0 0 1 18 17h-6.5L7 20.5V17H6a2.5 2.5 0 0 1-2.5-2.5V7A2.5 2.5 0 0 1 6 4.5Z" />
  <path d="M8.5 9.8v2M11 8.3v4.9M13.5 9.2v3.2M16 10.2v1.2" />
</>);

/** Catch me up: rewind, then three lines. */
export const IconCatchUp = make('catch-up', <>
  <path d="M3.6 12A8.4 8.4 0 1 0 6.1 6" />
  <path d="M3.3 3.5v3.6h3.6" />
  <path d="M9.6 9.6h5M9.6 12.4h5M9.6 15.2h3" />
</>);

/** Sound history: a waveform with a time tick. */
export const IconSounds = make('sounds', <>
  <path d="M3 12h1.5M6.5 8.5v7M10 5v14M13.5 9v6M17 10.5v3" />
  <path d="M20.5 7v2.2l1 .8" />
</>);

/** Repeat / doubt word: an ear over a dotted underline (same dotted line as doubt words). */
export const IconRepeat = make('repeat', <>
  <path d="M7 9.5a5 5 0 0 1 10 0c0 2.4-2 3.3-2.6 4.9-.4 1.2-.7 2-1.4 2.6a2.6 2.6 0 0 1-4.3-1.3" />
  <path d="M9.8 9.8a2.2 2.2 0 0 1 4.2-.9" />
  <path d="M4 21h1M8.5 21h1M13 21h1M17.5 21h1" />
</>);

/** The table: seats around a ring (Everyone joins). */
export const IconTable = make('table', <>
  <circle cx="12" cy="12" r="4.2" />
  <Dot cx={12} cy={3.6} r={1.7} /><Dot cx={20.4} cy={12} r={1.7} /><Dot cx={12} cy={20.4} r={1.7} /><Dot cx={3.6} cy={12} r={1.7} />
</>);

/** Receipt: a commitment on paper. */
export const IconReceipt = make('receipt', <>
  <path d="M6 3.5h12v17l-2.4-1.5-2.4 1.5-2.4-1.5-2.4 1.5L6 20.5Z" />
  <path d="M9 8.5h6M9 11.5h6M9 14.5h3.5" />
</>);

/** Phone as mic. */
export const IconPhoneMic = make('phone-mic', <>
  <rect x="6.5" y="2.8" width="11" height="18.4" rx="2.6" />
  <path d="M10.6 8.3a1.4 1.4 0 0 1 2.8 0v2.4a1.4 1.4 0 0 1-2.8 0Z" />
  <path d="M9.3 11a2.7 2.7 0 0 0 5.4 0M12 13.8v1.4" /><path d="M10.5 18.2h3" />
</>);

/** Name tag. */
export const IconName = make('name', <>
  <rect x="3.5" y="6" width="17" height="12.5" rx="2.5" />
  <path d="M9.5 3.5v3M14.5 3.5v3" />
  <circle cx="9" cy="12" r="1.8" /><path d="M13 11h4M13 14h2.5" />
</>);

/** Ledger: the running record. */
export const IconLedger = make('ledger', <>
  <path d="M5.5 3.5h11a2 2 0 0 1 2 2v15h-11a2 2 0 0 1-2-2Z" />
  <path d="M5.5 18.5a2 2 0 0 1 2-2h11" />
  <path d="M9 7.5h6M9 10.5h6" />
</>);
