import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Utterance } from '../../shared/types';
import { useRepeat } from './state/useRepeat';
import { postSay } from './state/api';
import { useSession } from './state/useSession';
import { around, colorForName, currentUtterance, lastMinutes, speakerColor, speakerName } from './state/session';
import { useInterject, useLastActivity } from './state/useInterject';
import { applyPrefs, loadPrefs, type Prefs } from './ui/prefs';
import { DesktopTop, LG, TableHead, TableLegend, Wordmark, useMedia } from './ui/Header';
import { TableTop, LampPill } from './ui/TableTop';
import { tableLamp } from './ui/tableLamp';
import { LaughCard } from './ui/LaughCard';
import { HouseRules } from './ui/HouseRules';
import { NowCard } from './ui/NowCard';
import { OpenCard } from './ui/OpenCard';
import { ForYouCard } from './ui/ForYouCard';
import { CatchupCard } from './ui/CatchupCard';
import { TimelineSheet } from './ui/TimelineSheet';
import { CaptionsStrip } from './ui/CaptionsStrip';
import { RenameDialog } from './ui/RenameDialog';
import { SettingsDrawer } from './ui/SettingsDrawer';
import { Onboarding } from './ui/Onboarding';
import { JoinQr } from './ui/JoinQr';
import { SpeakCard } from './ui/SpeakCard';
import { useAway, type AwayInterval } from './state/useAway';
import { CardDeck, CatchUpObject, PhonePlacemat, PhoneTable, SpeakObject } from './ui/PhoneTable';
import { AwayIndicator } from './ui/AwayIndicator';
import type { Seat } from './ui/TableRing';
import { IconCatchUp } from './ui/icons';
import { Button } from '@/components/ui/button';
import { Mic } from 'lucide-react';

/** Click gate: the mic's AudioContext needs a user gesture, so a saved name shows one big button instead of auto-starting. */
function StartGate({ name, onStart }: { name: string; onStart: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 px-6 text-center" role="dialog" aria-modal="true" aria-labelledby="start-gate-title">
      <Wordmark height={40} />
      <h1 id="start-gate-title" className="font-display-italic text-[3rem] leading-none [text-shadow:2px_3px_6px_rgb(27_20_16/.6)]">Hi {name}.</h1>
      <Button type="button" size="lg" onClick={onStart} autoFocus data-testid="start-listening"
        className="h-18 w-full max-w-sm text-[1.4rem] font-bold">
        <Mic aria-hidden /> Start listening
      </Button>
      <p className="max-w-sm text-body text-cream/85">Audio is transcribed live for this table only. Nothing is stored.</p>
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

  // Text-first "Speak for me": the line always goes to every joined phone as a Say card; it is
  // also spoken aloud only if the user opted into the synthetic voice. Returns phones reached.
  const { speakAtGap } = interject;
  const addLocal = s.addLocalUtterance;
  const voiceOn = prefs.voice;
  const sayLine = useCallback(async (text: string): Promise<number | null> => {
    const t = text.trim();
    if (!t) return null;
    const sent = postSay(t).then((r) => r.delivered).catch(() => null);
    if (voiceOn) speakAtGap(t); // voice path logs the line into the timeline itself (onSpoken)
    else addLocal(t);
    return sent;
  }, [voiceOn, speakAtGap, addLocal]);
  const sayApi = useMemo(() => ({ speakAtGap: (t: string) => { void sayLine(t); } }), [sayLine]);

  // Doubt words: tapping one asks the speaker to repeat it (on their phones, and aloud if voice is on).
  const nameOfId = useCallback((id: number) => speakerName(session, id), [session]);
  const { askRepeat } = useRepeat({ interject: sayApi, nameOf: nameOfId, markRepeat: s.markRepeat });
  const onAskRepeat = useCallback((u: Utterance) => { askRepeat(u); }, [askRepeat]);

  // Presence flares amber once per new "asked you" nudge.
  const [flare, setFlare] = useState(0);
  const nudgeId = s.nudge?.id;
  useEffect(() => { if (nudgeId) setFlare((f) => f + 1); }, [nudgeId]);

  useEffect(() => { applyPrefs(prefs); }, [prefs]);
  useEffect(() => { document.title = 'I Missed That'; }, []);

  const nameOf = useCallback((id: number) => speakerName(session, id), [session]);
  const colorOf = useCallback((id: number) => speakerColor(session, id), [session]);
  const colorFor = useCallback((name?: string) => colorForName(session, name), [session]);

  const now = currentUtterance(session);
  const loading = s.catchup.status === 'loading';
  // Styling only: invite a press (subtle pulse) when an away span ended after the last catch-up.
  const awayPending = !loading && s.catchup.status === 'idle' && !!awayApi.lastAway && awayApi.lastAway.t1 > session.lastSeenAt;
  const renameSp = renaming != null ? session.speakers[renaming] : undefined;

  // Table ring: joined phones when there are any, else the voices diarization has heard.
  const talking = now && (!now.final || Date.now() - s.lastTranscriptAt < 2500) ? now.speaker : null;
  const seatSource: 'phones' | 'voices' = s.participants.length ? 'phones' : 'voices';
  const seats: Seat[] = s.participants.length
    ? s.participants.map((p) => ({ id: p.id, name: p.name, color: colorOf(p.id), active: p.speaking }))
    : Object.values(session.speakers).filter((sp) => sp.id >= 0).map((sp) => ({ id: sp.id, name: nameOf(sp.id), color: colorOf(sp.id), active: sp.id === talking }));

  const desktop = useMedia(LG, false);
  const xl = useMedia('(min-width: 1280px)', false); // three columns around the table; below that, two
  // The table lamp mirrors the phones' lamp mode (server table message), else just "someone has the floor".
  const lamp = tableLamp(s.table, talking != null || seats.some((x) => x.active));
  const headerProps = {
    asr: s.asr, latency: s.latency, listening: s.listening,
    onToggleListening: () => s.setListening(!s.listening), onSettings: () => setSettingsOpen(true),
    onEveryoneJoins: () => setJoinOpen(true), participantCount: s.participants.length,
    lastTranscriptAt: s.lastTranscriptAt, requestPending: s.requestPending, micLevel: s.micLevel,
    speaking: interject.status === 'speaking',
    flare, seats, seatSource,
    lamp: <LampPill lamp={lamp} />,
    badge: <AwayIndicator enabled={awayApi.enabled} active={awayApi.active} away={awayApi.away} sim={awayApi.sim} />,
  };
  const host = session.me.name || 'you';
  const nowCard = (cls?: string) => (
    <NowCard utt={now} name={now ? nameOf(now.speaker) : ''} color={now ? colorOf(now.speaker) : ''} variant="placemat"
      empty={<HouseRules host={host} variant="mat" className="mt-1" />}
      onSpeaker={() => now && setRenaming(now.speaker)} onAskRepeat={onAskRepeat} className={cls} />
  );
  const openCard = (tall: boolean, cls?: string) => <OpenCard items={session.ledger} threads={s.threads} colorFor={colorFor} onOpen={setJumpT} tall={tall} className={cls ?? (tall ? 'h-full rounded-3xl' : 'flex-none')} />;
  const forYou = (cls?: string, bare = false) => (
    <ForYouCard items={session.ledger} nudge={s.nudge} bare={bare}
      nudgeColor={s.nudge?.speakerId != null ? colorOf(s.nudge.speakerId) : colorFor(s.nudge?.speaker)}
      colorFor={colorFor} onDismiss={s.dismissNudge} onOpen={setJumpT} className={cls} />
  );
  const catchup = <CatchupCard state={s.catchup} title={awayTitle ?? undefined} colorFor={colorFor} onBullet={setJumpT} onDismiss={s.dismissCatchup} />;
  const catchUpBtn = (
    <Button type="button" size="lg" onClick={manualCatchUp} disabled={loading} aria-busy={loading}
      className={`h-16 w-full shrink-0 text-[1.3rem] font-bold disabled:opacity-70 ${awayPending ? 'imt-invite' : ''}`}>
      <IconCatchUp size={26} strokeWidth={2} />
      {loading ? 'Catching you up…' : 'Catch me up'}
    </Button>
  );
  const laughs = (cls?: string) => (
    <LaughCard items={session.timeline} catchup={s.catchup} nameOf={nameOf} colorOf={colorOf} colorFor={colorFor}
      getNow={s.nowT} onOpen={setJumpT} className={cls} />
  );
  const captions = <CaptionsStrip items={session.timeline} nameOf={nameOf} colorOf={colorOf} onSpeaker={setRenaming} onAskRepeat={onAskRepeat} />;

  return (
    <div className={desktop ? 'mx-auto flex h-dvh max-w-[90rem] flex-col px-6 pb-5' : ''}>
      {desktop ? (
        <>
          <DesktopTop {...headerProps} />
          {/* The table is the layout: Plans | the table (placemat, seats, mug, mascot at the head) | Asked you + Why they laughed. */}
          <main className={xl
            ? 'room-light grid min-h-0 flex-1 grid-cols-[minmax(17rem,0.9fr)_minmax(0,1.75fr)_minmax(17rem,0.9fr)] grid-rows-[minmax(0,1fr)_auto_auto] gap-4'
            : 'room-light grid min-h-0 flex-1 grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)] grid-rows-[minmax(0,1fr)_auto_auto] gap-4'}>
            {xl && (
              <div className="relative min-h-0">
                {openCard(true)}
                {catchup}
              </div>
            )}
            <div className="flex min-h-0 flex-col">
              <TableTop className="flex-1" seats={seats} me={session.me.name} lamp={lamp}
                head={<TableHead {...headerProps} size={xl ? 104 : 88} />}
                placemat={nowCard('min-h-[31cqw]')} />
              {!xl && <LaughCard variant="strip" items={session.timeline} catchup={s.catchup} nameOf={nameOf} colorOf={colorOf} colorFor={colorFor} getNow={s.nowT} onOpen={setJumpT} className="px-2" />}
              <TableLegend {...headerProps} className="shrink-0 justify-center pt-1" />
            </div>
            <div className="relative flex min-h-0 flex-col gap-4">
              {forYou('max-h-[62%] shrink-0 overflow-y-auto rounded-3xl')}
              {xl ? laughs('min-h-0 flex-1') : (
                <>
                  {openCard(true, 'min-h-0 flex-1 rounded-3xl')}
                  {catchup}
                </>
              )}
            </div>
            <div className={xl ? 'col-span-3 grid grid-cols-[minmax(0,2.7fr)_minmax(0,0.95fr)] gap-4' : 'col-span-2 grid grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)] gap-4'}>
              {catchUpBtn}
              <div className="relative h-16">
                <SpeakCard api={interject} say={sayLine} voice={prefs.voice} floating className="h-16 text-[1.15rem] font-semibold" />
              </div>
            </div>
            <div className={xl ? 'col-span-3' : 'col-span-2'}>{captions}</div>
          </main>
        </>
      ) : (
        // Phones/tablets: a place setting on the walnut. One thing at a time; nothing scrolls.
        <PhoneTable header={headerProps} lamp={lamp}
          placemat={
            <PhonePlacemat utt={now} name={now ? nameOf(now.speaker) : ''} color={now ? colorOf(now.speaker) : ''}
              onSpeaker={() => now && setRenaming(now.speaker)} onAskRepeat={onAskRepeat} presence={headerProps}
              empty={<HouseRules host={host} variant="mat" className="mt-1" />}
              note={<CatchupCard variant="note" state={s.catchup} title={awayTitle ?? undefined} colorFor={colorFor} onBullet={setJumpT} onDismiss={s.dismissCatchup} />} />
          }
          deck={
            <CardDeck ringing={!!s.nudge} nudgeId={s.nudge?.id} cards={{
              asked: forYou('min-h-0 flex-1 overflow-hidden rounded-[8px_12px_10px_6px]', true),
              plans: openCard(false, 'deckle min-h-0 flex-1 rounded-none shadow-none'),
              laugh: laughs('deckle min-h-0 flex-1 rounded-none shadow-none'),
            }} />
          }
          objects={
            <>
              <SpeakCard api={interject} say={sayLine} voice={prefs.voice} sheet
                renderTrigger={({ onClick, ref }) => <SpeakObject onClick={onClick} btnRef={ref} />} />
              <CatchUpObject onClick={manualCatchUp} busy={loading} invite={awayPending} />
            </>
          } />
      )}

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
          onListening={s.setListening} onClose={() => setSettingsOpen(false)} away={awayApi}
          latency={s.latency} captionsOnly={s.asr.source === 'webspeech' && s.listening} />
      )}
      {joinOpen && <JoinQr participants={s.participants} colorOf={colorOf} onClose={() => setJoinOpen(false)}
        phonesOnly={s.phonesOnly} phonesOnlyPref={s.phonesOnlyPref} onPhonesOnly={s.setPhonesOnly} table={s.table} hostName={session.me.name} />}
      {!session.me.name && <Onboarding onDone={(n) => { s.setMe(n, []); s.start(); }} />}
      {session.me.name && !s.started && <StartGate name={session.me.name} onStart={s.start} />}
    </div>
  );
}
