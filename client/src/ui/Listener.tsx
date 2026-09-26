import { api, ensureRoom, roomToken } from '@/lib/room';
// "One at a time": the listener's phone. One sentence, one button, nothing else.
// Pure presentation: every piece of state comes from useSession / useInterject via App.
import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { Settings } from 'lucide-react';
import type { TimelineItem, Utterance } from '../../../shared/types';
import type { CatchupState, Nudge, SessionApi } from '../state/useSession';
import { isUtt } from '../state/session';
import { UttText } from './UttText';
import { cn } from '@/lib/utils';
import { VoiceStep, voiceAlreadyKnown } from '../enroll/VoiceStep';

/* ---------- top line: wordmark as text + the state word ---------- */

const TRANSCRIBING_WINDOW_MS = 1500;

export function stateWord(asr: SessionApi['asr'], listening: boolean, lastTranscriptAt: number, requestPending: boolean, speaking: boolean, now: number): string {
  if (speaking) return 'speaking';
  if (requestPending) return 'thinking';
  if (!listening || asr.state === 'paused') return 'paused';
  if (asr.state === 'error') return 'mic error';
  if (asr.state === 'closed') return 'offline';
  if (asr.state === 'open') return now - lastTranscriptAt < TRANSCRIBING_WINDOW_MS ? 'writing' : 'listening';
  return 'connecting';
}

/** Re-render every 300 ms so the listening/writing split follows wall-clock time. */
export function useTick(ms = 300) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => { const id = window.setInterval(tick, ms); return () => window.clearInterval(id); }, [ms]);
}

export function TopLine({ word, onSettings }: { word: string; onSettings: () => void }) {
  return (
    <header className="flex shrink-0 items-start justify-between gap-3 pt-4">
      <div className="min-w-0">
        <a href="/landing.html" className="font-display-italic text-[18px] leading-none text-ink">One at a time</a>
        <p className="oat-label mt-1.5" role="status" aria-live="off">{word}</p>
      </div>
      <button type="button" onClick={onSettings} aria-label="Settings"
        className="-mt-2 -mr-4 flex size-14 cursor-pointer items-center justify-center rounded-xl text-ink-2 hover:text-ink">
        <Settings size={24} strokeWidth={1.75} aria-hidden />
      </button>
    </header>
  );
}

/* ---------- the middle: one sentence ---------- */

const sentenceCls = (len: number) => cn('font-display-italic text-ink',
  len > 90 ? 'text-[1.882rem] leading-[1.15] lg:text-[2.6rem]' : 'text-[2.353rem] leading-[1.1] lg:text-[3.294rem]');
const nameCls = 'flex min-h-11 items-center gap-2.5 text-[1.176rem] leading-[1.2] font-bold text-ink';

/** The previous final line, faint, above the sentence: Fraunces italic at 55% of the sentence size. */
function PrevLine({ prev, big }: { prev?: { utt: Utterance; name: string }; big: boolean }) {
  if (!prev) return null;
  return (
    <p key={prev.utt.id} className="oat-in mb-3 flex min-w-0 items-baseline gap-2 opacity-60" aria-label={`Before: ${prev.name}: ${prev.utt.text}`}>
      <span className="shrink-0 font-mono text-[11px] tracking-[.14em] text-ink-2 uppercase">{prev.name}</span>
      <span className={cn('min-w-0 truncate font-display-italic leading-[1.2] text-ink-2', big ? 'text-[1.294rem] lg:text-[1.812rem]' : 'text-[1.035rem] lg:text-[1.43rem]')}>
        {prev.utt.text}
      </span>
    </p>
  );
}

export function Sentence({ utt, name, color, onSpeaker, onAskRepeat, prev }: {
  utt?: Utterance; name: string; color: string; onSpeaker: () => void; onAskRepeat: (u: Utterance) => void;
  prev?: { utt: Utterance; name: string };
}) {
  if (!utt) {
    return <p className={cn(sentenceCls(0), 'oat-in text-ink-2')}>Nobody is talking yet.</p>;
  }
  return (
    <div key={utt.id} className="oat-in">
      <PrevLine prev={prev} big={utt.text.length <= 90} />
      <div aria-live="polite">
      <button type="button" onClick={utt.speaker >= 0 ? onSpeaker : undefined} disabled={utt.speaker < 0}
        aria-label={utt.speaker >= 0 ? `${name}. Tap to rename.` : name}
        className={cn(nameCls, 'mb-1 cursor-pointer disabled:cursor-default')}>
        <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: color || 'var(--ink-2)' }} />
        {name}
        {utt.tone && utt.tone !== 'neutral' && <span className="oat-label oat-in font-normal" aria-label={`, sounds ${utt.tone}`}>· {utt.tone}</span>}
      </button>
      <p className={cn(sentenceCls(utt.text.length), 'line-clamp-[7]', !utt.final && 'text-ink/70')}>
        <UttText utt={utt} speaker={name} onAskRepeat={onAskRepeat} />
      </p>
      </div>
    </div>
  );
}

/* ---------- the amber moment: someone asked you ---------- */

export const ASK_MS = 10_000;

/** The page itself turns amber (App sets the background); this is the content in the sentence area. */
export function Asked({ nudge, color, onAnswer }: { nudge: Nudge; color: string; onAnswer: (label?: string) => void }) {
  useEffect(() => {
    const id = window.setTimeout(() => onAnswer(), ASK_MS);
    return () => window.clearTimeout(id);
  }, [nudge.id, onAnswer]);
  return (
    <section key={nudge.id} aria-live="assertive" data-testid="nudge" className="oat-in">
      <p className={cn(nameCls, 'mb-1')}>
        <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: color || 'var(--ink)' }} />
        {nudge.speaker} asked you
      </p>
      <p className={cn(sentenceCls(nudge.question.length), 'line-clamp-5')}>{nudge.question}</p>
      <div className="mt-7 flex gap-2">
        {['Yes', 'Clarify', "Can't"].map((l) => (
          <button key={l} type="button" onClick={() => onAnswer(l)}
            className="h-14 flex-1 cursor-pointer rounded-full bg-cream text-[1.1rem] font-bold text-ink">
            {l}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------- "What did I miss?": up to three plain lines, then back to the sentence ---------- */

export const MISSED_MS = 15_000;

export function Missed({ state, title, onDone }: { state: CatchupState; title?: string; onDone: () => void }) {
  const readyAt = state.status === 'ready' || state.status === 'error' ? state.at : null;
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    setLeaving(false);
    if (readyAt == null) return;
    const left = Math.max(0, MISSED_MS - (Date.now() - readyAt));
    const a = window.setTimeout(() => setLeaving(true), Math.max(0, left - 200));
    const b = window.setTimeout(onDone, left);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, [readyAt, onDone]);
  if (state.status === 'idle') return null;

  let lines: ReactNode[] = [];
  if (state.status === 'ready') {
    const d = state.data;
    const a = d.addressed_to_me;
    lines = [
      ...(a ? [<><b>{a.speaker}:</b> {a.question}</>] : []),
      ...d.bullets.map((b) => <>{b.speaker && <b>{b.speaker}: </b>}{b.text}</>),
    ].slice(0, 3);
  }
  return (
    <section aria-label="What you missed" aria-live="polite" onClick={onDone}
      className={cn('oat-in cursor-pointer transition-opacity duration-200', leaving && 'opacity-0')}>
      <h2 className="oat-label mb-4">{title ?? 'What you missed'}</h2>
      {state.status === 'loading' && <p className={cn(sentenceCls(0), 'text-ink-2')}>One moment…</p>}
      {state.status === 'error' && <p className="text-[1.176rem] text-ink">Couldn’t catch you up. Try again in a moment.</p>}
      {state.status === 'ready' && (lines.length ? (
        <ul className="space-y-4">
          {lines.map((l, k) => <li key={k} className="text-[1.176rem] leading-[1.35] text-ink">{l}</li>)}
        </ul>
      ) : <p className={cn(sentenceCls(0), 'text-ink-2')}>Nothing important. You’re caught up.</p>)}
    </section>
  );
}

/* ---------- optional caption list (Settings → Show captions) ---------- */

export function CaptionList({ items, nameOf, colorOf }: { items: TimelineItem[]; nameOf: (id: number) => string; colorOf: (id: number) => string }) {
  const box = useRef<HTMLDivElement>(null);
  const recent = items.filter(isUtt).slice(-40);
  useEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight; }, [recent.length]);
  return (
    <div ref={box} tabIndex={0} aria-label="Captions" className="max-h-[26dvh] shrink-0 overflow-y-auto border-t border-rule py-3">
      {recent.length === 0 && <p className="oat-label">No captions yet</p>}
      <ul className="space-y-1.5">
        {recent.map((u) => (
          <li key={u.id} className={cn('text-[1rem] leading-snug', !u.final && 'text-ink-2')}>
            <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: colorOf(u.speaker) }} />
            <b>{nameOf(u.speaker)}</b> {u.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- first run + the mic gate ---------- */

function FullPage({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-label={label}>
      <div className="mx-auto flex min-h-full max-w-[640px] flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="pt-3 font-display-italic text-[18px]">One at a time</p>
        {children}
      </div>
    </div>
  );
}

/** Main menu (first open): who is this phone for? The listener stays here; a speaker goes to the lamp page. */
export type Role = 'listener' | 'speaker';
export function loadRole(): Role | null {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('menu')) { localStorage.removeItem('imt.role'); return null; }
    if (q.get('me')) return 'listener';
    const v = localStorage.getItem('imt.role');
    return v === 'listener' ? 'listener' : null;
  } catch { return null; }
}
export function saveRole(role: Role) { try { localStorage.setItem('imt.role', role); } catch { /* ignore */ } }
export function goToPhone(code: string): void {
  const q = new URLSearchParams({ token: code.trim().toUpperCase(), voice: '1' });
  window.location.href = `/join.html?${q.toString()}`;
}
export function RoleGate({ onListener }: { onListener: () => void }) {
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [code, setCode] = useState('');
  return (
    <FullPage label="Who is this phone for?">
      <div className="my-auto flex flex-col gap-6 py-10">
        <h1 className="font-display-italic text-[2.353rem] leading-none">Who is this phone for?</h1>
        <p className="text-[1.176rem] text-ink-2">One phone reads. Every other phone goes on the table and becomes a lamp.</p>
        <button type="button" disabled={busy} onClick={() => { setBusy(true); void ensureRoom().finally(onListener); }} data-testid="role-listener"
          className="flex h-20 w-full cursor-pointer flex-col items-center justify-center rounded-full bg-amber text-ink">
          <span className="text-[1.176rem] font-bold">{busy ? 'Opening your table…' : 'I’m reading'}</span>
          <span className="text-[0.94rem]">the hard-of-hearing person</span>
        </button>
        {asking ? (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (code.trim().length >= 4) goToPhone(code); }}>
            <label className="block">
              <span className="oat-label mb-2 block">Table code · on the reader’s screen</span>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))} autoFocus
                inputMode="text" autoCapitalize="characters" autoComplete="off" placeholder="K7PM" aria-label="Table code" data-testid="table-code"
                className="h-16 w-full rounded-xl border border-rule bg-cream px-4 text-center font-mono text-[1.6rem] tracking-[.3em] text-ink placeholder:text-ink-2" />
            </label>
            <button type="submit" disabled={code.length < 4} className="h-16 w-full cursor-pointer rounded-full border-2 border-ink text-[1.176rem] font-bold text-ink disabled:opacity-40">Put me on the table</button>
          </form>
        ) : (
          <button type="button" disabled={busy} onClick={() => setAsking(true)} data-testid="role-speaker"
            className="flex h-20 w-full cursor-pointer flex-col items-center justify-center rounded-full border-2 border-ink text-ink disabled:opacity-50">
            <span className="text-[1.176rem] font-bold">I’m talking</span>
            <span className="text-[0.94rem]">put my phone on the table</span>
          </button>
        )}
        <p className="oat-label">Nothing is stored</p>
      </div>
    </FullPage>
  );
}

export function FirstRun({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <FullPage label="Welcome">
      <form className="my-auto flex flex-col gap-5 py-10" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onDone(name.trim()); }}>
        <label className="block">
          <span className="mb-2 block text-[1.176rem] font-bold">What’s your name?</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" placeholder="Your first name" autoFocus
            className="h-16 w-full rounded-xl border border-rule bg-cream px-4 text-[1.176rem] text-ink placeholder:text-ink-2" />
          <span className="mt-3 block text-[1rem] text-ink-2">So the page turns amber when someone asks you something.</span>
        </label>
        <button type="submit" disabled={!name.trim()}
          className="h-16 w-full cursor-pointer rounded-full bg-amber text-[1.176rem] font-bold text-ink disabled:cursor-default disabled:opacity-40">Start</button>
      </form>
    </FullPage>
  );
}

/** The mic's AudioContext needs a user gesture: a saved name shows one button instead of auto-starting. */
export function StartGate({ name, onStart }: { name: string; onStart: () => void }) {
  const [code, setCode] = useState(roomToken());
  useEffect(() => { let dead = false; void ensureRoom().then((c) => { if (!dead) setCode(c); }); return () => { dead = true; }; }, []);
  return (
    <FullPage label="Start listening">
      <div className="my-auto flex flex-col gap-6 py-10">
        <h1 className="font-display-italic text-[2.353rem] leading-none">Hi {name}.</h1>
        <p className="text-[1.176rem] text-ink-2">Put the phone on the table. Voices show as Speaker 1, 2… tap a name to rename it. Nothing is stored.</p>
        {code && (
          <p className="border-y border-rule py-4" data-testid="table-code-shown">
            <span className="oat-label block">Table code · others tap “I’m talking” and type it</span>
            <span className="mt-1 block font-mono text-[2.2rem] tracking-[.3em] text-ink">{code}</span>
          </p>
        )}
        <button type="button" onClick={onStart} autoFocus data-testid="start-listening"
          className="h-16 w-full cursor-pointer rounded-full bg-amber text-[1.176rem] font-bold text-ink">Start listening</button>
      </div>
    </FullPage>
  );
}

/** After the name, before "Start listening": teach the table this voice (skipped when already known). */
export function VoiceGate({ name, onDone, onRename }: { name: string; onDone: () => void; onRename?: (name: string) => void }) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let dead = false;
    void (async () => {
      let t = '';
      try {
        const r = await fetch(api('/api/room'));
        if (r.ok) t = ((await r.json()) as { token?: string }).token ?? '';
      } catch { /* offline: the POST will fail and we continue */ }
      if (dead) return;
      if (await voiceAlreadyKnown(t, name)) { if (!dead) onDone(); return; }
      if (!dead) setToken(t);
    })();
    return () => { dead = true; };
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <FullPage label="Teach the table your voice">
      {token != null && <VoiceStep name={name} token={token} onDone={onDone} onRename={onRename} />}
      {token != null && (
        <button type="button" onClick={onDone} data-testid="voice-skip"
          className="mb-6 min-h-14 w-full cursor-pointer rounded-xl text-[1rem] text-ink-2 underline-offset-4 hover:underline">
          Skip. The table tells voices apart as Speaker 1, 2… and you tap a name to rename it.
        </button>
      )}
    </FullPage>
  );
}
