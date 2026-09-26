import type { Utterance } from '../../../shared/types';
import { SpeakerChip } from './SpeakerChip';

interface Props {
  utt?: Utterance;
  name: string;
  color: string;
  onSpeaker: () => void;
}

/** Who is speaking + current/last sentence. Fixed height: replaces in place, never jitters. */
export function NowCard({ utt, name, color, onSpeaker }: Props) {
  return (
    <section aria-label="Now speaking" className="h-[8.6rem] shrink-0 overflow-hidden rounded-2xl border border-line bg-card px-4 py-3"
      style={utt ? { borderLeft: `6px solid ${color}` } : undefined}>
      <div className="mb-1.5 flex h-8 items-center gap-2">
        <span className="text-[0.75rem] font-semibold tracking-wider text-muted uppercase">Now</span>
        {utt && <SpeakerChip name={name} color={color} onClick={utt.speaker >= 0 ? onSpeaker : undefined} />}
      </div>
      {utt ? (
        <p className={`line-clamp-3 text-[1.2rem] leading-snug ${utt.final ? 'text-fg' : 'text-fg/75'}`}>{utt.text}</p>
      ) : (
        <p className="text-[1.1rem] text-muted">Waiting for someone to speak…</p>
      )}
    </section>
  );
}
