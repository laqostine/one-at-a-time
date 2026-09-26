import { useEffect, useRef, useState } from 'react';
import { Loader2, Megaphone, Square, Volume2, X } from 'lucide-react';
import type { InterjectIntent } from '../../../shared/types';
import { MAX_WAIT_MS, type InterjectApi } from '../state/useInterject';

interface Props { api: InterjectApi }

const INTENTS: { intent: InterjectIntent; label: string }[] = [
  { intent: 'object', label: 'Object' },
  { intent: 'question', label: 'Ask' },
  { intent: 'clarify', label: 'Repeat?' },
  { intent: 'agree', label: 'Agree' },
];

const isTyping = (el: Element | null) =>
  !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);

/** "Speak for me": one tap drafts re-entry lines; tapping one says it aloud at the next pause. */
export function SpeakCard({ api }: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const firstChip = useRef<HTMLButtonElement>(null);
  const openBtn = useRef<HTMLButtonElement>(null);
  const { status, options, line, error } = api;
  const busy = status === 'waiting' || status === 'speaking';

  const openAndDraft = () => { setOpen(true); void api.draft(); };
  const close = () => { api.reset(); setOpen(false); setCustom(''); openBtn.current?.focus(); };

  // Keyboard: S opens (when not typing), Escape stops speech / closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if ((e.key === 's' || e.key === 'S') && !isTyping(document.activeElement)) {
        const dialogOpen = !!document.querySelector('[role="dialog"]');
        if (dialogOpen || open) return;
        e.preventDefault();
        openAndDraft();
      } else if (e.key === 'Escape' && open) {
        if (busy) api.stop(); else close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Move focus to the first drafted line once they arrive.
  useEffect(() => { if (open && status === 'ready' && options.length) firstChip.current?.focus(); }, [open, status, options]);

  const statusText =
    status === 'drafting' ? 'Drafting lines…'
    : status === 'waiting' ? 'Waiting for a gap…'
    : status === 'speaking' ? 'Speaking'
    : status === 'error' ? `Couldn't draft lines (${error}).`
    : status === 'ready' && open ? `${options.length} line${options.length === 1 ? '' : 's'} ready. Tap one to say it at the next pause.`
    : '';

  if (!open) {
    return (
      <button ref={openBtn} type="button" onClick={openAndDraft} aria-keyshortcuts="S"
        className="flex h-14 w-full shrink-0 items-center justify-center gap-2 rounded-2xl border-2 border-accent bg-card text-[1.2rem] font-bold text-accent hover:bg-card-2">
        <Megaphone size={22} aria-hidden /> Speak for me <kbd className="ml-1 rounded border border-line px-1.5 text-[0.75rem] font-normal text-muted">S</kbd>
      </button>
    );
  }

  return (
    <section aria-label="Speak for me" className="shrink-0 rounded-2xl border-2 border-accent bg-card px-3 py-3">
      <div className="flex items-center gap-2 pb-2">
        <h2 className="text-[0.75rem] font-semibold tracking-wider text-accent uppercase">Speak for me</h2>
        <p role="status" aria-live="polite" aria-atomic="true"
          className={`ml-auto flex items-center gap-1.5 text-[0.9rem] ${busy ? 'font-semibold text-warn' : status === 'error' ? 'text-bad' : 'text-muted'}`}>
          {(status === 'drafting' || status === 'waiting') && <Loader2 size={16} className="animate-spin" aria-hidden />}
          {status === 'speaking' && <Volume2 size={16} aria-hidden />}
          {statusText}
        </p>
        <button type="button" onClick={close} aria-label="Close Speak for me" className="rounded-lg p-1 text-muted hover:text-fg">
          <X size={20} aria-hidden />
        </button>
      </div>

      {busy && line && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border-2 border-warn bg-warn/10 px-3 py-2">
          <q className="min-w-0 flex-1 text-[1.15rem] font-semibold leading-snug">{line}</q>
          <button type="button" onClick={api.stop} aria-label="Stop speaking"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-bad px-3 py-2 text-[1rem] font-bold text-black hover:brightness-110">
            <Square size={16} aria-hidden /> Stop
          </button>
        </div>
      )}
      {status === 'waiting' && <p className="sr-only">Will speak within {MAX_WAIT_MS / 1000} seconds.</p>}

      {status === 'drafting' && !options.length && (
        <div className="space-y-2" aria-hidden>{[88, 72, 80].map((w) => <div key={w} className="imt-skeleton h-12" style={{ width: `${w}%` }} />)}</div>
      )}

      {options.length > 0 && (
        <ul className="space-y-2" aria-label="Lines to say">
          {options.map((o, k) => (
            <li key={`${o.kind}-${k}-${o.line}`}>
              <button ref={k === 0 ? firstChip : undefined} type="button" disabled={busy} onClick={() => api.speakAtGap(o.line)}
                aria-label={`${o.label}: ${o.line}. Say it at the next pause.`}
                className="flex w-full items-start gap-3 rounded-xl border border-line bg-card-2 px-3 py-2.5 text-left hover:border-accent disabled:opacity-50">
                <span className="mt-0.5 shrink-0 rounded-md bg-accent/15 px-2 py-0.5 text-[0.8rem] font-semibold text-accent">{o.label}</span>
                <span className="text-[1.2rem] leading-snug">{o.line}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Draft a different kind of line">
        {INTENTS.map((i) => (
          <button key={i.intent} type="button" disabled={status === 'drafting' || busy} onClick={() => void api.draft(i.intent)}
            className="rounded-full border border-line px-3 py-1 text-[0.9rem] text-muted hover:border-fg hover:text-fg disabled:opacity-50">
            {i.label}
          </button>
        ))}
      </div>

      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) { api.speakAtGap(custom); setCustom(''); } }}>
        <label htmlFor="imt-speak-custom" className="sr-only">Your own line</label>
        <input id="imt-speak-custom" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={200}
          placeholder="Type your own line…" autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-line bg-card-2 px-3 py-2 text-[1.1rem] placeholder:text-muted focus:border-accent" />
        <button type="button" disabled={!custom.trim() || status === 'drafting' || busy} onClick={() => void api.draft('custom', custom)}
          className="rounded-xl border border-line px-3 text-[0.95rem] text-muted hover:text-fg disabled:opacity-50">Polish</button>
        <button type="submit" disabled={!custom.trim() || busy}
          className="rounded-xl bg-accent px-4 text-[1rem] font-bold text-black hover:brightness-110 disabled:opacity-50">Say it</button>
      </form>
    </section>
  );
}
