import { IconRepeat } from './icons';
import type { Utterance } from '../../../shared/types';
import { hasDoubt } from '../state/confidence';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { SpeakerChip } from './SpeakerChip';
import { UttText } from './UttText';
import { cn } from '@/lib/utils';

interface Props {
  utt?: Utterance;
  name: string;
  color: string;
  onSpeaker: () => void;
  /** Ask the speaker to repeat the doubtful words (useRepeat().askRepeat). */
  onAskRepeat?: (utt: Utterance) => void;
  className?: string;
}

/** Who is speaking + current/last sentence. Fixed height: replaces in place, never jitters. */
export function NowCard({ utt, name, color, onSpeaker, onAskRepeat, className }: Props) {
  const doubt = !!utt && utt.final && hasDoubt(utt);
  return (
    <Card aria-label="Now speaking" role="region"
      className={cn('relative h-[9.8rem] shrink-0 gap-2 overflow-hidden py-3.5 pl-5 sm:h-[9rem] sm:py-4 sm:pl-6', className)}>
      {/* speaker color rail: position-absolute so its presence never shifts the text */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 transition-colors duration-200"
        style={{ background: utt ? color : 'var(--line)' }} />
      <CardHeader className="h-8">
        <CardTitle>Now</CardTitle>
        {utt && <SpeakerChip name={name} color={color} onClick={utt.speaker >= 0 ? onSpeaker : undefined} />}
        {utt && !utt.final && <span className="ml-auto font-mono text-[0.72rem] tracking-wide text-muted">typing…</span>}
        {doubt && onAskRepeat && !utt.repeatRequested && (
          <button type="button" onClick={() => onAskRepeat(utt)}
            aria-label={`Didn't catch part of that. Ask ${name} to repeat at the next pause.`}
            className="ml-auto flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-accent/40 px-3 text-[0.8rem] font-semibold text-accent transition-colors duration-150 hover:bg-accent/10">
            <IconRepeat size={16} strokeWidth={2} /> Repeat?
          </button>
        )}
      </CardHeader>
      {utt ? (
        <p key={utt.id} className={`imt-in line-clamp-3 font-display text-[1.6rem] leading-[1.14] sm:line-clamp-2 sm:text-[1.95rem] lg:line-clamp-3 lg:text-[2.3rem] lg:leading-[1.12] ${utt.final ? 'text-fg' : 'text-fg/75'}`}>
          <UttText utt={utt} speaker={name} onAskRepeat={onAskRepeat} />
        </p>
      ) : (
        <p className="text-body text-muted">Waiting for someone to speak…</p>
      )}
    </Card>
  );
}
