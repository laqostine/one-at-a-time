// One-tap "please repeat": speaks a polite ask for the doubtful words via the existing
// interjection TTS (speakAtGap waits for a pause), and flags the utterance so the UI can show it.
import { useCallback } from 'react';
import type { Utterance } from '../../../shared/types';
import type { InterjectApi } from './useInterject';
import { lowConfidenceSpans } from './confidence';

const tail = (text: string, n = 6) => text.trim().split(/\s+/).slice(-n).join(' ');
const clean = (s: string) => s.replace(/["'“”‘’]/g, '').replace(/[.,!?;:]+$/g, '').trim();

/** "Sorry Sam, could you repeat: 'Nokia 3310'?" — doubtful span(s), else the last 6 words. */
export function buildRepeatLine(utt: Pick<Utterance, 'text' | 'words'>, speaker: string): string {
  const spans = lowConfidenceSpans(utt);
  const what = clean(spans.length ? spans.map((s) => s.text).join(' … ') : tail(utt.text)) || clean(tail(utt.text));
  const who = speaker && !/^(unknown|speaker \d+)$/i.test(speaker.trim()) ? ` ${speaker.trim()}` : '';
  return `Sorry${who}, could you repeat: '${what}'?`;
}

interface Deps {
  interject: Pick<InterjectApi, 'speakAtGap'>;
  /** display name for a speaker id (e.g. (id) => speakerName(session, id)) */
  nameOf: (id: number) => string;
  /** session action: sets utt.repeatRequested = true (useSession().markRepeat) */
  markRepeat: (id: string) => void;
}

export function useRepeat({ interject, nameOf, markRepeat }: Deps) {
  const { speakAtGap } = interject;
  const askRepeat = useCallback((utt: Utterance) => {
    const line = buildRepeatLine(utt, nameOf(utt.speaker));
    markRepeat(utt.id);
    speakAtGap(line);
    return line;
  }, [speakAtGap, nameOf, markRepeat]);
  return { askRepeat };
}
export type RepeatApi = ReturnType<typeof useRepeat>;
