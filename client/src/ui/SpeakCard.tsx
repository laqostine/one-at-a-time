import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import type { InterjectIntent } from '../../../shared/types';
import { MAX_WAIT_MS, type InterjectApi } from '../state/useInterject';
import { cn } from '@/lib/utils';

interface Props {
  api: InterjectApi;
  /** Text-first: show the line on every joined phone (POST /api/room/say). Resolves to phones reached. */
  say?: (line: string) => Promise<number | null>;
  /** "Also say it aloud (synthetic voice)" pref. */
  voice?: boolean;
  /** Desktop: the open panel rises over the grid from the actions row instead of pushing it. */
  floating?: boolean;
  /** Phone: the closed state is an object on the table (the mug), rendered by the caller. */
  renderTrigger?: (p: { onClick: () => void; ref: Ref<HTMLButtonElement> }) => ReactNode;
  /** Phone: the open panel is a paper note that slides up over the bottom of the table. */
  sheet?: boolean;
  className?: string;
}

const INTENTS: { intent: InterjectIntent; label: string }[] = [
  { intent: 'object', label: 'Object' },
  { intent: 'question', label: 'Ask' },
  { intent: 'clarify', label: 'Repeat?' },
  { intent: 'agree', label: 'Agree' },
];

const isTyping = (el: Element | null) =>
  !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);

/** "Speak for me": one tap drafts re-entry lines; tapping one says it aloud at the next pause. */
export function SpeakCard({ api, say, voice = true, floating = false, renderTrigger, sheet = false, className }: Props) {
  const [sent, setSent] = useState<{ line: string; delivered: number | null } | null>(null);
  // Always: the line goes to the phones first. Voice: only if the user opted in.
  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    if (say) {
      setSent({ line: t, delivered: null });
      void say(t).then((n) => setSent((cur) => (cur?.line === t ? { line: t, delivered: n } : cur)));
    }
    // `say` already speaks aloud when the voice pref is on; only speak here when there is no text path.
    if (!say) api.speakAtGap(t);
  };
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const firstChip = useRef<HTMLButtonElement>(null);
  const openBtn = useRef<HTMLButtonElement>(null);
  const { status, options, line, error } = api;
  const busy = status === 'waiting' || status === 'speaking';

  const openAndDraft = () => { setOpen(true); void api.draft(); };
  const close = () => { api.reset(); setOpen(false); setCustom(''); setSent(null); openBtn.current?.focus(); };

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
  useEffect(() => { if (open && status === 'ready' && options.length && !isTyping(document.activeElement)) firstChip.current?.focus(); }, [open, status, options]);

  const statusText =
    status === 'drafting' ? 'Drafting a few lines…'
    : status === 'waiting' ? 'Waiting for a gap…'
    : status === 'speaking' ? 'Speaking'
    : status === 'error' ? `Couldn't draft lines (${error}).`
    : status === 'ready' && open ? `${options.length} line${options.length === 1 ? '' : 's'} ready. Tap one to ${say ? 'show it on every phone' : 'say it at the next pause'}.`
    : '';

  if (!open) {
    if (renderTrigger) return <>{renderTrigger({ onClick: openAndDraft, ref: openBtn })}</>;
    return (
      <button ref={openBtn} type="button" onClick={openAndDraft} aria-keyshortcuts="S"
        className={cn('h-16 w-full shrink-0 cursor-pointer rounded-2xl bg-ink text-[1.15rem] font-bold text-cream', className)}>
        Say something
      </button>
    );
  }

  const chip = 'h-12 cursor-pointer rounded-full border border-line-strong px-4 text-[0.95rem] font-bold text-ink transition-colors duration-150 hover:border-ink disabled:cursor-default disabled:opacity-40';
  return (
    <>
      {sheet && <div aria-hidden onClick={close} className="oat-fade fixed inset-0 z-30 bg-[rgb(27_22_17/.28)]" />}
      <section aria-label="Say something" role="dialog" aria-modal={sheet || undefined}
        className={cn('oat-in shrink-0 bg-bg text-ink',
          floating && 'absolute right-0 bottom-0 z-30 max-h-[min(34rem,70dvh)] w-[34rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-line p-5',
          sheet && 'fixed inset-x-0 bottom-0 z-40 mx-auto max-h-[85dvh] w-full max-w-[640px] overflow-y-auto rounded-t-3xl border-t border-line px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]',
          !floating && !sheet && 'rounded-2xl border border-line p-5', className)}>
        <div className="flex min-h-16 items-center gap-3">
          <h2 className="font-display-italic text-[1.5rem] leading-none">Say something</h2>
          <button type="button" onClick={close} className="ml-auto -mr-2 h-14 min-w-14 cursor-pointer rounded-xl px-3 font-bold text-ink underline-offset-4 hover:underline">
            Close
          </button>
        </div>
        <p role="status" aria-live="polite" aria-atomic="true"
          className={cn('min-h-6 font-mono text-[0.78rem] tracking-[0.06em]', busy ? 'font-bold text-warn' : status === 'error' ? 'text-bad' : 'text-muted')}>
          {sent && !busy
            ? (sent.delivered == null ? 'Sending to every phone…' : sent.delivered > 0 ? `On ${sent.delivered} phone${sent.delivered === 1 ? '' : 's'} now` : 'No phones on the table yet')
            : statusText}
        </p>

        {sent && !busy && <q className="mt-1 block font-display-italic text-[1.5rem] leading-[1.15]">{sent.line}</q>}
        {busy && line && (
          <div className="mt-2 flex items-center gap-3">
            <q className="min-w-0 flex-1 font-display-italic text-[1.4rem] leading-[1.15]">{line}</q>
            <button type="button" onClick={api.stop} className="h-14 shrink-0 cursor-pointer rounded-xl bg-bad px-5 font-bold text-cream">Stop</button>
          </div>
        )}
        {status === 'waiting' && <p className="sr-only">Will speak within {MAX_WAIT_MS / 1000} seconds.</p>}

        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) { send(custom); setCustom(''); } }}>
          <label htmlFor="imt-speak-custom" className="sr-only">What do you want to say?</label>
          <input id="imt-speak-custom" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={200}
            placeholder="Type it here…" autoComplete="off"
            className="h-16 min-w-0 flex-1 rounded-2xl border border-line-strong bg-card px-4 text-[1.1rem] text-ink placeholder:text-muted focus:border-ink" />
          <button type="submit" disabled={!custom.trim() || busy}
            className="h-16 shrink-0 cursor-pointer rounded-2xl bg-ink px-6 text-[1.1rem] font-bold text-cream disabled:cursor-default disabled:opacity-35">Send</button>
        </form>

        {status === 'drafting' && !options.length && (
          <div className="mt-4 space-y-2" aria-hidden>{[88, 72, 80].map((w) => <div key={w} className="imt-skeleton h-14" style={{ width: `${w}%` }} />)}</div>
        )}
        {options.length > 0 && (
          <ul className="mt-4 divide-y divide-line border-y border-line" aria-label="Or tap a line">
            {options.map((o, k) => (
              <li key={`${o.kind}-${k}-${o.line}`}>
                <button ref={k === 0 ? firstChip : undefined} type="button" disabled={busy} onClick={() => send(o.line)}
                  aria-label={`${o.label}: ${o.line}. ${say ? (voice ? 'Show on every phone and say it at the next pause.' : 'Show on every phone.') : 'Say it at the next pause.'}`}
                  className="flex min-h-16 w-full cursor-pointer flex-col items-start justify-center gap-0.5 py-3 text-left disabled:cursor-default disabled:opacity-50">
                  <span className="font-mono text-[0.7rem] font-bold tracking-[0.12em] text-muted uppercase">{o.label}</span>
                  <span className="text-[1.1rem] leading-snug font-semibold">{o.line}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Draft a different kind of line">
          {INTENTS.map((i) => (
            <button key={i.intent} type="button" disabled={status === 'drafting' || busy} onClick={() => void api.draft(i.intent)} className={chip}>
              {i.label}
            </button>
          ))}
          <button type="button" disabled={!custom.trim() || status === 'drafting' || busy} onClick={() => void api.draft('custom', custom)} className={chip}>Polish mine</button>
        </div>
      </section>
    </>
  );
}
