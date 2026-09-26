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
import { useAway, type AwayInterval } from './state/useAway';
import { AwayIndicator } from './ui/AwayIndicator';
import { Button } from '@/components/ui/button';
import { Mic, Sparkles } from 'lucide-react';

/** Click gate: the mic's AudioContext needs a user gesture, so a saved name shows one big button instead of auto-starting. */
function StartGate({ name, onStart }: { name: string; onStart: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-bg px-6 text-center" role="dialog" aria-modal="true" aria-labelledby="start-gate-title">
      <div className="card-label text-accent!">I Missed That</div>
      <h1 id="start-gate-title" className="text-[2rem] leading-tight font-bold tracking-tight">Hi {name}</h1>
      <Button type="button" size="lg" onClick={onStart} autoFocus data-testid="start-listening"
        className="h-18 w-full max-w-sm text-[1.4rem] font-bold">
        <Mic aria-hidden /> Start listening
      </Button>
      <p className="max-w-sm text-body text-muted">Audio is transcribed live for this table only. Nothing is stored.</p>
    </div>
  );
}

export default function App() {
  const s = useSession();
  const { session } = s;
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [jumpT, setJumpT] = useState<number | null>(null);

  // "Away" detection (camera, on-device): coming back after >=4s auto-opens "While you looked away".
  const [awayTitle, setAwayTitle] = useState<string | null>(null);
  const catchUpSince = useCallback((iv: AwayInterval) => {
    setAwayTitle(`While you looked away (${Math.round((iv.t1 - iv.t0) / 1000)}s)`);
    void s.catchUp({ sinceT: iv.t0 });
  }, [s.catchUp]); // eslint-disable-line react-hooks/exhaustive-deps
  const awayApi = useAway({
    nowSessionMs: s.nowT,
    onReturn: (iv) => { if (iv.t1 - iv.t0 >= 4_000) catchUpSince(iv); },
  });
  useEffect(() => { if (s.catchup.status === 'idle') setAwayTitle(null); }, [s.catchup.status]);
  // Manual "Catch me up" defaults to the last away span if it ended after the last catch-up.
  const manualCatchUp = () => {
    const la = awayApi.lastAway;
    if (la && la.t1 > session.lastSeenAt) catchUpSince(la);
    else { setAwayTitle(null); void s.catchUp(); }
  };

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
  // Styling only: invite a press (subtle pulse) when an away span ended after the last catch-up.
  const awayPending = !loading && s.catchup.status === 'idle' && !!awayApi.lastAway && awayApi.lastAway.t1 > session.lastSeenAt;
  const renameSp = renaming != null ? session.speakers[renaming] : undefined;

  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col">
      <Header asr={s.asr} latency={s.latency} listening={s.listening}
        onToggleListening={() => s.setListening(!s.listening)} onSettings={() => setSettingsOpen(true)}
        onEveryoneJoins={() => setJoinOpen(true)} participantCount={s.participants.length}
        lastTranscriptAt={s.lastTranscriptAt} requestPending={s.requestPending} micLevel={s.micLevel}
        badge={<AwayIndicator enabled={awayApi.enabled} active={awayApi.active} away={awayApi.away} sim={awayApi.sim} />} />

      <main className="flex min-h-0 flex-1 flex-col gap-2.5 px-3 pb-3 sm:gap-3 sm:px-4 sm:pb-4">
        <NowCard utt={now} name={now ? nameOf(now.speaker) : ''} color={now ? colorOf(now.speaker) : ''}
          onSpeaker={() => now && setRenaming(now.speaker)} />

        <div className="relative flex min-h-0 flex-1 flex-col gap-2.5 sm:gap-3">
          <OpenCard items={session.ledger} colorFor={colorFor} onOpen={setJumpT} />
          <ForYouCard items={session.ledger} nudge={s.nudge}
            nudgeColor={s.nudge?.speakerId != null ? colorOf(s.nudge.speakerId) : colorFor(s.nudge?.speaker)}
            colorFor={colorFor} onDismiss={s.dismissNudge} onOpen={setJumpT} />
          <SpeakCard api={interject} />
          <CatchupCard state={s.catchup} title={awayTitle ?? undefined} colorFor={colorFor} onBullet={setJumpT} onDismiss={s.dismissCatchup} />
        </div>

        <Button type="button" size="lg" onClick={manualCatchUp} disabled={loading} aria-busy={loading}
          className={`h-16 w-full shrink-0 text-[1.3rem] font-bold disabled:opacity-70 ${awayPending ? 'imt-invite' : ''}`}>
          <Sparkles aria-hidden className="size-6" />
          {loading ? 'Catching you up…' : 'Catch me up'}
        </Button>

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
          onListening={s.setListening} onClose={() => setSettingsOpen(false)} away={awayApi} />
      )}
      {joinOpen && <JoinQr participants={s.participants} colorOf={colorOf} onClose={() => setJoinOpen(false)}
        phonesOnly={s.phonesOnly} phonesOnlyPref={s.phonesOnlyPref} onPhonesOnly={s.setPhonesOnly} table={s.table} />}
      {!session.me.name && <Onboarding onDone={(n) => { s.setMe(n, []); s.start(); }} />}
      {session.me.name && !s.started && <StartGate name={session.me.name} onStart={s.start} />}
    </div>
  );
}
