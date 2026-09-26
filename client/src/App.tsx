import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AudioEvent, Utterance } from '../../shared/types';
import { useRepeat } from './state/useRepeat';
import { useSession } from './state/useSession';
import { colorForName, currentUtterance, lastMinutes, speakerColor, speakerName } from './state/session';
import { useInterject, useLastActivity } from './state/useInterject';
import { useAway, type AwayInterval } from './state/useAway';
import { applyPrefs, loadPrefs, type Prefs } from './ui/prefs';
import { RenameDialog } from './ui/RenameDialog';
import { SettingsDrawer } from './ui/SettingsDrawer';
import { SpeakCard } from './ui/SpeakCard';
import { TablePage, openPlans } from './ui/TablePage';
import type { CatchupResponse } from '../../shared/types';
import { Asked, CaptionList, FirstRun, Missed, Sentence, StartGate, TopLine, stateWord, useTick } from './ui/Listener';

const LAUGH_MS = 6_000;

/**
 * One at a time: the listener's phone. One sentence, one button ("Say something"), one quiet link
 * ("What did I miss?"). Desktop simply centers the same column at 640px.
 */
export default function App() {
  const s = useSession();
  const { session } = s;
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renaming, setRenaming] = useState<number | null>(null);
  // The second page ("The table"): opened by swipe up or the PLANS label, never on its own.
  const [tableOpen, setTableOpen] = useState(false);
  const [lastCatchup, setLastCatchup] = useState<{ data: CatchupResponse; title?: string } | null>(null);
  const swipeY = useRef<number | null>(null);
  useTick();

  // "Notice when I look away" (camera, on-device): coming back after >=4s opens "What did I miss?".
  const [awayTitle, setAwayTitle] = useState<string | null>(null);
  const catchUpSince = useCallback((iv: AwayInterval) => {
    setAwayTitle(`since you looked away · ${Math.round((iv.t1 - iv.t0) / 1000)} s`);
    void s.catchUp({ sinceT: iv.t0 });
  }, [s.catchUp]); // eslint-disable-line react-hooks/exhaustive-deps
  const awayApi = useAway({
    nowSessionMs: s.nowT,
    onReturn: (iv) => { if (iv.t1 - iv.t0 >= 4_000) catchUpSince(iv); },
  });
  useEffect(() => { if (s.catchup.status === 'idle') setAwayTitle(null); }, [s.catchup.status]);
  useEffect(() => {
    if (s.catchup.status === 'ready') setLastCatchup({ data: s.catchup.data, title: awayTitle ?? undefined });
  }, [s.catchup]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const voiceOn = false; // DESIGN.md: no voice on this phone; "The clerk speaks for me" speaks on the table's phones
  const clerkOn = prefs.clerkSpeaks;
  const sayLine = useCallback(async (text: string): Promise<number | null> => {
    const t = text.trim();
    if (!t) return null;
    // voice: the table's phones read the line aloud (server attaches audio, else phones use speechSynthesis).
    const sent = fetch('/api/room/say', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: t, voice: clerkOn }) })
      .then((r) => (r.ok ? (r.json() as Promise<{ delivered?: number }>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((r) => r.delivered ?? null).catch(() => null);
    if (voiceOn) speakAtGap(t); // the voice path logs the line into the timeline itself (onSpoken)
    else addLocal(t);
    return sent;
  }, [voiceOn, clerkOn, speakAtGap, addLocal]);
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
  // The first "asked you" can fire on an interim line ("Bera, are"): show the utterance it grew into.
  const nudge = useMemo(() => {
    const n = s.nudge;
    if (!n) return n;
    const q = n.question.trim();
    const full = [...session.timeline].reverse().find((i): i is Utterance => !('type' in i && i.type === 'event')
      && (i as Utterance).text.trim().length > q.length && (i as Utterance).text.trim().startsWith(q));
    return full ? { ...n, question: full.text.trim() } : n;
  }, [s.nudge, session.timeline]);
  // "The table laughed.": the host's `laugh` message (exposed as laughAt when the session carries it)
  // or a recent laughter event on the timeline. Shown quietly for 6 s.
  const lastLaughEv = [...session.timeline].reverse().find((i): i is AudioEvent => 'type' in i && i.type === 'event' && i.kind === 'laughter');
  const laughAt = Math.max((s as { laughAt?: number }).laughAt ?? 0, lastLaughEv ? session.startedAt + lastLaughEv.t : 0);
  const laughed = Date.now() - laughAt < LAUGH_MS;
  // The ask always takes over the home: close the second page when a new question arrives.
  useEffect(() => { if (nudge?.id) setTableOpen(false); }, [nudge?.id]);
  const planCount = openPlans(session.ledger).length;
  const nudgeColor = nudge?.speakerId != null ? colorOf(nudge.speakerId) : colorFor(nudge?.speaker);

  return (
    <div className="mx-auto flex h-dvh max-w-[640px] flex-col px-5 pt-[env(safe-area-inset-top)] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      style={nudge ? ({ ['--ink-2' as string]: 'var(--ink)' }) : undefined}
      onTouchStart={(e) => { swipeY.current = e.touches[0].clientY; }}
      onTouchEnd={(e) => { const y0 = swipeY.current; swipeY.current = null; if (y0 != null && !nudge && y0 - e.changedTouches[0].clientY > 70) setTableOpen(true); }}>
      {/* Asked you: the whole page turns amber for 10 s (200 ms background transition). */}
      <div aria-hidden className="fixed inset-0 -z-10 transition-colors duration-200" style={{ background: nudge ? 'var(--amber)' : 'var(--cream)' }} />
      <TopLine word={nudge ? 'asked you' : word} onSettings={() => setSettingsOpen(true)} />

      <main className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden py-4">
        {nudge ? (
          <Asked nudge={nudge} color={nudgeColor} onAnswer={s.dismissNudge} />
        ) : s.catchup.status !== 'idle' ? (
          <Missed state={s.catchup} title={awayTitle ?? undefined} onDone={s.dismissCatchup} />
        ) : (
          <>
            <Sentence utt={now} name={now ? nameOf(now.speaker) : ''} color={now ? colorOf(now.speaker) : ''}
              onSpeaker={() => now && setRenaming(now.speaker)} onAskRepeat={onAskRepeat} />
            <p className={`oat-label mt-6 min-h-4 transition-opacity duration-200 ${laughed ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
              {laughed ? 'The table laughed' : ''}
            </p>
          </>
        )}
      </main>

      {prefs.captions && <CaptionList items={session.timeline} nameOf={nameOf} colorOf={colorOf} />}

      <div className="shrink-0 pt-2">
        <SpeakCard api={interject} say={sayLine} voice={clerkOn} sheet
          renderTrigger={({ onClick, ref }) => (
            <button ref={ref} type="button" onClick={onClick} aria-keyshortcuts="S"
              className={`h-16 w-full cursor-pointer rounded-full text-[1.176rem] font-bold text-ink transition-colors duration-200 ${nudge ? 'bg-cream' : 'bg-amber'}`}>
              Say something
            </button>
          )} />
        <button type="button" onClick={manualCatchUp} disabled={loading} aria-busy={loading}
          className="mt-1 h-14 w-full cursor-pointer rounded-xl text-[1rem] font-medium text-ink-2 underline-offset-4 hover:underline focus-visible:underline disabled:cursor-default">
          {loading ? 'Catching you up…' : 'What did I miss?'}
        </button>
        <button type="button" onClick={() => setTableOpen(true)} aria-label={`Plans: ${planCount} open. Open the table.`}
          className={`oat-label -mt-1 h-14 w-full cursor-pointer hover:text-ink ${planCount ? '' : 'invisible'}`} data-testid="plans-label">
          Plans · {planCount}
        </button>
      </div>

      {tableOpen && (
        <TablePage ledger={session.ledger} nudge={nudge} lastCatchup={lastCatchup}
          onAnswerNudge={s.dismissNudge} onClose={() => setTableOpen(false)} />
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
          participantCount={s.participants.length}
          captionsOnly={s.asr.source === 'webspeech' && s.listening} />
      )}
      {!session.me.name && <FirstRun onDone={(n) => { s.setMe(n, []); s.start(); }} />}
      {session.me.name && !s.started && <StartGate name={session.me.name} onStart={s.start} />}
    </div>
  );
}
