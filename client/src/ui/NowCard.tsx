import type { Utterance } from '../../../shared/types';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card aria-label="Now speaking" role="region"
      className="relative h-[9.2rem] shrink-0 gap-1.5 overflow-hidden py-3.5 pl-5 sm:h-[10rem] sm:py-4 sm:pl-6">
      {/* speaker color rail: position-absolute so its presence never shifts the text */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 transition-colors duration-200"
        style={{ background: utt ? color : 'var(--line)' }} />
      <CardHeader className="h-8">
        <CardTitle>Now</CardTitle>
        {utt && <SpeakerChip name={name} color={color} onClick={utt.speaker >= 0 ? onSpeaker : undefined} />}
        {utt && !utt.final && <span className="ml-auto text-meta">typing…</span>}
      </CardHeader>
      {utt ? (
        <p key={utt.id} className={`imt-in line-clamp-3 text-body-lg font-medium ${utt.final ? 'text-fg' : 'text-fg/80'}`}>{utt.text}</p>
      ) : (
        <p className="text-body text-muted">Waiting for someone to speak…</p>
      )}
    </Card>
  );
}
