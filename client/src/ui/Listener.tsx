// "One at a time": the listener's phone. One sentence, one button, nothing else.
// Pure presentation: every piece of state comes from useSession / useInterject via App.
import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { Settings } from 'lucide-react';
import type { TimelineItem, Utterance } from '../../../shared/types';
import type { CatchupState, Nudge, SessionApi } from '../state/useSession';
import { isUtt } from '../state/session';
import { UttText } from './UttText';
import { cn } from '@/lib/utils';

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
    <header className="flex h-16 shrink-0 items-center gap-3">
      <a href="/landing.html" className="font-display-italic text-[18px] leading-none text-ink">One at a time</a>
      <span className="font-mono text-[13px] leading-none text-muted" role="status" aria-live="off">{word}</span>
      <button type="button" onClick={onSettings} aria-label="Settings"
        className="-mr-3 ml-auto flex size-14 cursor-pointer items-center justify-center rounded-2xl text-ink transition-colors duration-150 hover:bg-card-2">
        <Settings size={24} strokeWidth={1.75} aria-hidden />
      </button>
    </header>
  );
}

/* ---------- the middle: one sentence ---------- */

const sentenceCls = 'font-display-italic text-[1.9rem] leading-[1.14] text-ink sm:text-[2.1rem]';

export function Sentence({ utt, name, color, onSpeaker, onAskRepeat }: {
  utt?: Utterance; name: string; color: string; onSpeaker: () => void; onAskRepeat: (u: Utterance) => void;
}) {
  if (!utt) {
    return <p className={cn(sentenceCls, 'oat-fade text-muted')}>Waiting for someone to speak.</p>;
  }
  return (
    <div key={utt.id} className="oat-in" aria-live="polite">
      <button type="button" onClick={utt.speaker >= 0 ? onSpeaker : undefined} disabled={utt.speaker < 0}
        aria-label={utt.speaker >= 0 ? `${name}. Tap to rename.` : name}
        className="-ml-1 mb-2 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-1 text-[1.05rem] font-bold text-ink disabled:cursor-default">
        <span aria-hidden className="size-3.5 shrink-0 rounded-full" style={{ background: color || 'var(--line-strong)' }} />
        {name}
      </button>
      <p className={cn(sentenceCls, 'line-clamp-[7]', !utt.final && 'text-ink/70')}>
        <UttText utt={utt} speaker={name} onAskRepeat={onAskRepeat} />
      </p>
    </div>
  );
}

/* ---------- the amber moment: someone asked you ---------- */

export const ASK_MS = 10_000;

export function Asked({ nudge, color, onAnswer }: { nudge: Nudge; color: string; onAnswer: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onAnswer, ASK_MS);
    return () => window.clearTimeout(id);
  }, [nudge.id, onAnswer]);
  return (
    <section key={nudge.id} aria-live="assertive" data-testid="nudge"
      className="oat-in -mx-1 rounded-3xl bg-amber px-5 py-6 text-ink">
      <p className="flex items-center gap-2.5 text-[1.05rem] font-bold">
        <span aria-hidden className="size-3.5 shrink-0 rounded-full ring-2 ring-ink/20" style={{ background: color || 'var(--ink)' }} />
        {nudge.speaker} asked you:
      </p>
      <q className={cn(sentenceCls, 'mt-2 line-clamp-5 block')}>{nudge.question}</q>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {['Yes', 'Clarify', "Can't"].map((l) => (
          <button key={l} type="button" onClick={onAnswer}
            className="h-14 cursor-pointer rounded-2xl border-2 border-ink/80 text-[1.05rem] font-bold text-ink transition-colors duration-150 hover:bg-ink hover:text-amber">
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
      ...(a ? [<><b>{a.speaker}</b> asked you: {a.question}</>] : []),
      ...d.bullets.map((b) => <>{b.speaker && <b>{b.speaker}: </b>}{b.text}</>),
    ].slice(0, 3);
  }
  return (
    <section aria-label="What you missed" aria-live="polite" onClick={onDone}
      className={cn('oat-in cursor-pointer transition-opacity duration-200', leaving && 'opacity-0')}>
      <h2 className="mb-4 font-mono text-[13px] tracking-[0.04em] text-muted">{title ?? 'what you missed'}</h2>
      {state.status === 'loading' && <p className={cn(sentenceCls, 'text-muted')}>One moment…</p>}
      {state.status === 'error' && <p className="text-body text-bad">Couldn’t catch you up. Try again in a moment.</p>}
      {state.status === 'ready' && (lines.length ? (
        <ol className="space-y-4">
          {lines.map((l, k) => (
            <li key={k} className="flex gap-3 text-[1.2rem] leading-[1.35] text-ink">
              <span aria-hidden className="w-5 shrink-0 font-mono text-[0.85rem] leading-[1.9] text-muted">{k + 1}</span>
              <span className="min-w-0">{l}</span>
            </li>
          ))}
        </ol>
      ) : <p className={cn(sentenceCls, 'text-muted')}>Nothing important. You’re caught up.</p>)}
    </section>
  );
}

/* ---------- optional caption list (Settings → Show captions) ---------- */

export function CaptionList({ items, nameOf, colorOf }: { items: TimelineItem[]; nameOf: (id: number) => string; colorOf: (id: number) => string }) {
  const box = useRef<HTMLDivElement>(null);
  const recent = items.filter(isUtt).slice(-40);
  useEffect(() => { const el = box.current; if (el) el.scrollTop = el.scrollHeight; }, [recent.length]);
  return (
    <div ref={box} tabIndex={0} aria-label="Captions" className="max-h-[28dvh] shrink-0 overflow-y-auto border-t border-line py-3">
      {recent.length === 0 && <p className="text-[0.95rem] text-muted">No captions yet.</p>}
      <ul className="space-y-1.5">
        {recent.map((u) => (
          <li key={u.id} className={cn('text-[0.95rem] leading-snug', !u.final && 'text-muted')}>
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
        <p className="font-display-italic text-[18px]">One at a time</p>
        {children}
      </div>
    </div>
  );
}

export function FirstRun({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <FullPage label="Welcome">
      <form className="my-auto flex flex-col gap-5 py-10" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onDone(name.trim()); }}>
        <h1 className="font-display-italic text-[2.4rem] leading-[1.05]">One sentence at a time, on your phone.</h1>
        <label className="block">
          <span className="mb-2 block text-[1.05rem] font-bold">What’s your name?</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" placeholder="Your first name" autoFocus
            className="h-16 w-full rounded-2xl border border-line-strong bg-card px-4 text-[1.2rem] text-ink placeholder:text-muted focus:border-ink" />
          <span className="mt-2 block text-[0.95rem] text-muted">So the screen turns amber when someone asks you something.</span>
        </label>
        <button type="submit" disabled={!name.trim()}
          className="h-16 w-full cursor-pointer rounded-2xl bg-ink text-[1.15rem] font-bold text-cream disabled:cursor-default disabled:opacity-35">Start</button>
      </form>
    </FullPage>
  );
}

/** The mic's AudioContext needs a user gesture: a saved name shows one button instead of auto-starting. */
export function StartGate({ name, onStart }: { name: string; onStart: () => void }) {
  return (
    <FullPage label="Start listening">
      <div className="my-auto flex flex-col gap-6 py-10">
        <h1 className="font-display-italic text-[3rem] leading-none">Hi {name}.</h1>
        <p className="text-body text-muted">Put the phone on the table. Nothing is stored.</p>
        <button type="button" onClick={onStart} autoFocus data-testid="start-listening"
          className="h-16 w-full cursor-pointer rounded-2xl bg-ink text-[1.15rem] font-bold text-cream">Start listening</button>
      </div>
    </FullPage>
  );
}
