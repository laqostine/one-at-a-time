// An utterance's text with "doubt words" (ASR confidence < 0.6) dimmed + dotted-underlined.
// Each doubtful run is a button: one tap asks the speaker to repeat it (via useRepeat).
import type { Utterance } from '../../../shared/types';
import { wordSegments } from '../state/confidence';
import { cn } from '@/lib/utils';

interface Props {
  utt: Utterance;
  speaker: string;
  onAskRepeat?: (utt: Utterance) => void;
}

export function UttText({ utt, speaker, onAskRepeat }: Props) {
  const segs = utt.final ? wordSegments(utt) : [{ text: utt.text, low: false }];
  return (
    <>
      {segs.map((sg, i) => {
        if (!sg.low) return <span key={i}>{sg.text}</span>;
        if (!onAskRepeat || utt.repeatRequested) {
          return <span key={i} className="doubt" title="Not sure this was heard right">{sg.text}</span>;
        }
        return (
          <button key={i} type="button" onClick={(e) => { e.stopPropagation(); onAskRepeat(utt); }}
            title="Not sure this was heard right. Tap to ask them to repeat."
            aria-label={`Unsure: "${sg.text}". Ask ${speaker || 'them'} to repeat it at the next pause.`}
            className={cn('doubt -mx-0.5 -my-1 inline cursor-pointer rounded-md px-0.5 py-1 align-baseline transition-colors duration-150',
              'hover:bg-accent/12 hover:text-fg focus-visible:text-fg')}>
            {sg.text}
          </button>
        );
      })}
      {utt.repeatRequested && (
        <span className="ml-2 inline-flex translate-y-[-0.1em] items-center rounded-full border border-accent/35 bg-accent/10 px-2 align-middle font-mono text-[0.68rem] tracking-wide text-accent uppercase">
          asked to repeat
        </span>
      )}
    </>
  );
}
