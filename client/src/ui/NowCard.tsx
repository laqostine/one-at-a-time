import type { ReactNode } from 'react';
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
  /** 'placemat' = the linen mat in the middle of the table (serif sentence in ink). */
  variant?: 'card' | 'placemat';
  /** Placemat only: what lies on the mat before anyone has spoken (the house rules). */
  empty?: ReactNode;
  className?: string;
}

/** Who is speaking + current/last sentence. Fixed height: replaces in place, never jitters. */
export function NowCard({ utt, name, color, onSpeaker, onAskRepeat, variant = 'card', empty, className }: Props) {
  const doubt = !!utt && utt.final && hasDoubt(utt);
  const repeatBtn = doubt && onAskRepeat && !utt.repeatRequested && (
    <button type="button" onClick={() => onAskRepeat(utt)}
      aria-label={`Didn't catch part of that. Ask ${name} to repeat at the next pause.`}
      className="ml-auto flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-accent/40 px-3 text-[0.85rem] font-semibold text-accent transition-colors duration-150 hover:bg-accent/10">
      <IconRepeat size={16} strokeWidth={2} /> Repeat?
    </button>
  );

  if (variant === 'placemat') {
    return (
      <section aria-label="On the placemat: what is being said now" role="region"
        className={cn('linen relative flex flex-col overflow-hidden rounded-[46%_54%_50%_48%/10%_9%_10%_9%] px-7 pt-4 pb-5 sm:px-9', className)}>
        <div className="flex h-9 shrink-0 items-center gap-2">
          <span aria-hidden className="h-[3px] w-10 rounded-full bg-[#c28e66]" />
          {utt ? (
            <button type="button" onClick={utt.speaker >= 0 ? onSpeaker : undefined} disabled={utt.speaker < 0}
              aria-label={utt.speaker >= 0 ? `${name}, rename speaker` : name}
              className="flex min-w-0 cursor-pointer items-center gap-2 rounded-full text-[1rem] font-bold text-ink disabled:cursor-default">
              <span aria-hidden className="size-3 shrink-0 rounded-full ring-2 ring-ink/15" style={{ background: color }} />
              <span className="truncate">{name}</span>
              <span className="font-normal text-ink-muted">{utt.final ? 'said' : 'is saying'}</span>
            </button>
          ) : <span className="font-mono text-[0.72rem] font-semibold tracking-[0.16em] text-ink-muted uppercase">The placemat</span>}
          {repeatBtn}
        </div>
        {utt ? (
          <p key={utt.id} className={cn('imt-in mt-1 line-clamp-3 font-display text-[1.75rem] leading-[1.12] sm:text-[2.1rem] lg:line-clamp-4 lg:text-[clamp(1.35rem,5.2cqw,2.5rem)] lg:leading-[1.1]', utt.final ? 'text-ink' : 'text-ink/75')}>
            <UttText utt={utt} speaker={name} onAskRepeat={onAskRepeat} />
          </p>
        ) : empty ?? <p className="mt-1 font-display text-[1.6rem] leading-tight text-ink-muted">Waiting for someone to speak…</p>}
      </section>
    );
  }

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
        {repeatBtn}
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
