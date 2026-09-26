import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AudioEvent } from '../../shared/types';
import { useSession } from './state/useSession';
import { around, colorForName, currentUtterance, lastMinutes, speakerColor, speakerName } from './state/session';
import { useInterject, useLastActivity } from './state/useInterject';
import { applyPrefs, loadPrefs, type Prefs } from './ui/prefs';
import { Header } from './ui/Header';
import { NowCard } from './ui/NowCard';
import { OpenCard } from './ui/OpenCard';
import { ForYouCard } from './ui/ForYouCard';
import { CatchupCard } from './ui/CatchupCard';
import { TimelineSheet } from './ui/TimelineSheet';
import { CaptionsStrip } from './ui/CaptionsStrip';
import { RenameDialog } from './ui/RenameDialog';
import { SettingsDrawer } from './ui/SettingsDrawer';
import { Onboarding } from './ui/Onboarding';
import { SoundHistory } from './ui/SoundHistory';
import { JoinQr } from './ui/JoinQr';
import { SpeakCard } from './ui/SpeakCard';

export default function App() {
  const s = useSession();
  const { session } = s;
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [jumpT, setJumpT] = useState<number | null>(null);

  // "Speak for me": gap detection follows timeline activity (live ASR or replay alike).
  const lastActivityAt = useLastActivity(session.timeline);
  const interject = useInterject({
    getContext: () => ({ me: session.me, speakers: session.speakers, window: lastMinutes(session, 1, s.nowT()), ledger: session.ledger }),
    lastActivityAt,
    onSpoken: s.addLocalUtterance,
  });

  useEffect(() => { applyPrefs(prefs); }, [prefs]);
  useEffect(() => { document.title = 'I Missed That'; }, []);

  const nameOf = useCallback((id: number) => speakerName(session, id), [session]);
  const colorOf = useCallback((id: number) => speakerColor(session, id), [session]);
  const colorFor = useCallback((name?: string) => colorForName(session, name), [session]);

  const now = currentUtterance(session);
  const events = useMemo(() => session.timeline.filter((i): i is AudioEvent => i.type === 'event'), [session.timeline]);
  const loading = s.catchup.status === 'loading';
  const renameSp = renaming != null ? session.speakers[renaming] : undefined;

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col">
      <Header asr={s.asr} latency={s.latency} listening={s.listening}
        onToggleListening={() => s.setListening(!s.listening)} onSettings={() => setSettingsOpen(true)}
        onEveryoneJoins={() => setJoinOpen(true)} participantCount={s.participants.length}
        lastTranscriptAt={s.lastTranscriptAt} requestPending={s.requestPending} micLevel={s.micLevel} />

      <main className="flex min-h-0 flex-1 flex-col gap-2 px-3 pb-3">
        <NowCard utt={now} name={now ? nameOf(now.speaker) : ''} color={now ? colorOf(now.speaker) : ''}
          onSpeaker={() => now && setRenaming(now.speaker)} />

        <div className="relative flex min-h-0 flex-1 flex-col gap-2">
          <OpenCard items={session.ledger} colorFor={colorFor} onOpen={setJumpT} />
          <ForYouCard items={session.ledger} nudge={s.nudge}
            nudgeColor={s.nudge?.speakerId != null ? colorOf(s.nudge.speakerId) : colorFor(s.nudge?.speaker)}
            colorFor={colorFor} onDismiss={s.dismissNudge} onOpen={setJumpT} />
          <SpeakCard api={interject} />
          <CatchupCard state={s.catchup} colorFor={colorFor} onBullet={setJumpT} onDismiss={s.dismissCatchup} />
        </div>

        <button type="button" onClick={() => void s.catchUp()} disabled={loading} aria-busy={loading}
          className="h-16 w-full shrink-0 rounded-2xl bg-accent text-[1.3rem] font-bold text-black transition-opacity hover:brightness-110 disabled:opacity-60">
          {loading ? 'Catching you up…' : 'Catch me up'}
        </button>

        <SoundHistory events={events} getNow={s.nowT} />
        <CaptionsStrip items={session.timeline} nameOf={nameOf} colorOf={colorOf} onSpeaker={setRenaming} />
      </main>

      {jumpT != null && (
        <TimelineSheet t={jumpT} items={around(session, jumpT)} nameOf={nameOf} colorOf={colorOf} onClose={() => setJumpT(null)} />
      )}
      {renameSp && (
        <RenameDialog speaker={renameSp} current={nameOf(renameSp.id)}
          others={Object.values(session.speakers).filter((o) => o.id !== renameSp.id).map((o) => ({ id: o.id, name: nameOf(o.id) }))}
          onRename={(n) => s.renameSpeaker(renameSp.id, n)} onMerge={(to) => s.mergeSpeaker(renameSp.id, to)}
          onClose={() => setRenaming(null)} />
      )}
      {settingsOpen && (
        <SettingsDrawer me={session.me} prefs={prefs} listening={s.listening} onMe={s.setMe} onPrefs={setPrefs}
          onListening={s.setListening} onClose={() => setSettingsOpen(false)} />
      )}
      {joinOpen && <JoinQr participants={s.participants} colorOf={colorOf} onClose={() => setJoinOpen(false)} />}
      {!session.me.name && <Onboarding onDone={(n) => s.setMe(n, [])} />}
    </div>
  );
}
