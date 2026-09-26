import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Utterance } from '../../shared/types';
import { useRepeat } from './state/useRepeat';
import { postSay } from './state/api';
import { useSession } from './state/useSession';
import { colorForName, currentUtterance, lastMinutes, speakerColor, speakerName } from './state/session';
import { useInterject, useLastActivity } from './state/useInterject';
import { useAway, type AwayInterval } from './state/useAway';
import { applyPrefs, loadPrefs, type Prefs } from './ui/prefs';
import { RenameDialog } from './ui/RenameDialog';
import { SettingsDrawer } from './ui/SettingsDrawer';
import { JoinQr } from './ui/JoinQr';
import { SpeakCard } from './ui/SpeakCard';
import { Asked, CaptionList, FirstRun, Missed, Sentence, StartGate, TopLine, stateWord, useTick } from './ui/Listener';

/**
 * One at a time: the listener's phone. One sentence, one button ("Say something"), one quiet link
 * ("What did I miss?"). Desktop simply centers the same column at 640px.
 */
export default function App() {
  const s = useSession();
  const { session } = s;
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [renaming, setRenaming] = useState<number | null>(null);
  useTick();

  // "Notice when I look away" (camera, on-device): coming back after >=4s opens "What did I miss?".
  const [awayTitle, setAwayTitle] = useState<string | null>(null);
  const catchUpSince = useCallback((iv: AwayInterval) => {
    setAwayTitle(`while you looked away · ${Math.round((iv.t1 - iv.t0) / 1000)}s`);
    void s.catchUp({ sinceT: iv.t0 });
  }, [s.catchUp]); // eslint-disable-line react-hooks/exhaustive-deps
  const awayApi = useAway({
    nowSessionMs: s.nowT,
    onReturn: (iv) => { if (iv.t1 - iv.t0 >= 4_000) catchUpSince(iv); },
  });
  useEffect(() => { if (s.catchup.status === 'idle') setAwayTitle(null); }, [s.catchup.status]);
  const manualCatchUp = () => {
    const la = awayApi.lastAway;
    if (la && la.t1 > session.lastSeenAt) catchUpSince(la);
    else { setAwayTitle(null); void s.catchUp(); }
  };

  // "Say something": the line goes to every joined phone; spoken aloud here only if the user opted in.
  const lastActivityAt = useLastActivity(session.timeline);
  const interject = useInterject({
    getContext: () => ({ me: session.me, speakers: session.speakers, window: lastMinutes(session, 1, s.nowT()), ledger: session.ledger }),
    lastActivityAt,
    onSpoken: s.addLocalUtterance,
  });
  const { speakAtGap } = interject;
  const addLocal = s.addLocalUtterance;
  const voiceOn = prefs.voice;
  const sayLine = useCallback(async (text: string): Promise<number | null> => {
    const t = text.trim();
    if (!t) return null;
    const sent = postSay(t).then((r) => r.delivered).catch(() => null);
    if (voiceOn) speakAtGap(t); // the voice path logs the line into the timeline itself (onSpoken)
    else addLocal(t);
    return sent;
  }, [voiceOn, speakAtGap, addLocal]);
  const sayApi = useMemo(() => ({ speakAtGap: (t: string) => { void sayLine(t); } }), [sayLine]);

  // Doubt words: tapping one asks the speaker to repeat it.
  const nameOf = useCallback((id: number) => speakerName(session, id), [session]);
  const colorOf = useCallback((id: number) => speakerColor(session, id), [session]);
  const colorFor = useCallback((name?: string) => colorForName(session, name), [session]);
  const { askRepeat } = useRepeat({ interject: sayApi, nameOf, markRepeat: s.markRepeat });
  const onAskRepeat = useCallback((u: Utterance) => { askRepeat(u); }, [askRepeat]);

  useEffect(() => { applyPrefs(prefs); }, [prefs]);
  useEffect(() => { document.title = 'One at a time'; }, []);

  const now = currentUtterance(session);
  const loading = s.catchup.status === 'loading';
  const renameSp = renaming != null ? session.speakers[renaming] : undefined;
  const word = stateWord(s.asr, s.listening, s.lastTranscriptAt, s.requestPending, interject.status === 'speaking', Date.now());
  const nudge = s.nudge;
  const nudgeColor = nudge?.speakerId != null ? colorOf(nudge.speakerId) : colorFor(nudge?.speaker);

  return (
    <div className="mx-auto flex h-dvh max-w-[640px] flex-col px-5 pt-[env(safe-area-inset-top)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <TopLine word={nudge ? 'asked you' : word} onSettings={() => setSettingsOpen(true)} />

      <main className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden py-4">
        {nudge ? (
          <Asked nudge={nudge} color={nudgeColor} onAnswer={s.dismissNudge} />
        ) : s.catchup.status !== 'idle' ? (
          <Missed state={s.catchup} title={awayTitle ?? undefined} onDone={s.dismissCatchup} />
        ) : (
          <Sentence utt={now} name={now ? nameOf(now.speaker) : ''} color={now ? colorOf(now.speaker) : ''}
            onSpeaker={() => now && setRenaming(now.speaker)} onAskRepeat={onAskRepeat} />
        )}
      </main>

      {prefs.captions && <CaptionList items={session.timeline} nameOf={nameOf} colorOf={colorOf} />}

      <div className="shrink-0 pt-2">
        <SpeakCard api={interject} say={sayLine} voice={prefs.voice} sheet
          renderTrigger={({ onClick, ref }) => (
            <button ref={ref} type="button" onClick={onClick} aria-keyshortcuts="S"
              className="h-16 w-full cursor-pointer rounded-2xl bg-ink text-[1.15rem] font-bold text-cream transition-opacity duration-150 active:opacity-85">
              Say something
            </button>
          )} />
        <button type="button" onClick={manualCatchUp} disabled={loading} aria-busy={loading}
          className="mt-1 h-14 w-full cursor-pointer rounded-2xl text-[1.05rem] font-bold text-ink underline decoration-line-strong decoration-2 underline-offset-[6px] disabled:cursor-default disabled:opacity-60">
          {loading ? 'Catching you up…' : 'What did I miss?'}
        </button>
      </div>

      {renameSp && (
        <RenameDialog speaker={renameSp} current={nameOf(renameSp.id)}
          others={Object.values(session.speakers).filter((o) => o.id !== renameSp.id).map((o) => ({ id: o.id, name: nameOf(o.id) }))}
          onRename={(n) => s.renameSpeaker(renameSp.id, n)} onMerge={(to) => s.mergeSpeaker(renameSp.id, to)}
          onClose={() => setRenaming(null)} />
      )}
      {settingsOpen && (
        <SettingsDrawer me={session.me} prefs={prefs} listening={s.listening} onMe={s.setMe} onPrefs={setPrefs}
          onListening={s.setListening} onClose={() => setSettingsOpen(false)} away={awayApi}
          onAddPhones={() => { setSettingsOpen(false); setJoinOpen(true); }} participantCount={s.participants.length}
          captionsOnly={s.asr.source === 'webspeech' && s.listening} />
      )}
      {joinOpen && <JoinQr participants={s.participants} colorOf={colorOf} onClose={() => setJoinOpen(false)}
        phonesOnly={s.phonesOnly} phonesOnlyPref={s.phonesOnlyPref} onPhonesOnly={s.setPhonesOnly} table={s.table}
        hostName={session.me.name} clerkSpeaks={prefs.clerkSpeaks} clerkVoice={prefs.clerkVoice} />}
      {!session.me.name && <FirstRun onDone={(n) => { s.setMe(n, []); s.start(); }} />}
      {session.me.name && !s.started && <StartGate name={session.me.name} onStart={s.start} />}
    </div>
  );
}
