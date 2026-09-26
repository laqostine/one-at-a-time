import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
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


const isTyping = (el: Element | null) =>
  !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);

/** "Speak for me": one tap drafts re-entry lines; tapping one says it aloud at the next pause. */
export function SpeakCard({ api, say, floating = false, renderTrigger, sheet = false, className }: Props) {
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
  const { status, options, line } = api;
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

  if (!open) {
    if (renderTrigger) return <>{renderTrigger({ onClick: openAndDraft, ref: openBtn })}</>;
    return (
      <button ref={openBtn} type="button" onClick={openAndDraft} aria-keyshortcuts="S"
        className={cn('h-16 w-full shrink-0 cursor-pointer rounded-2xl bg-ink text-[1.15rem] font-bold text-cream', className)}>
        Say something
      </button>
    );
  }

  // DESIGN.md: sending closes the sheet (the line is already on every phone).
  const sendAndClose = (text: string) => { send(text); close(); };
  const shown = options.slice(0, 3);
  return (
    <>
      {sheet && <div aria-hidden onClick={close} className="oat-fade fixed inset-0 z-30 bg-[rgb(23_19_15/.3)]" />}
      <section aria-label="Say something" role="dialog" aria-modal={sheet || undefined}
        className={cn('shrink-0 bg-cream text-ink',
          floating && 'oat-in absolute right-0 bottom-0 z-30 max-h-[min(34rem,70dvh)] w-[34rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl p-5',
          sheet && 'oat-up fixed inset-x-0 bottom-0 z-40 mx-auto max-h-[88dvh] w-full max-w-[640px] overflow-y-auto rounded-t-xl px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]',
          !floating && !sheet && 'rounded-xl p-5', className)}>
        <div className="flex min-h-14 items-center gap-3">
          <h2 className="font-display-italic text-[1.5rem] leading-none">Say something</h2>
          <button type="button" onClick={close} className="ml-auto -mr-3 h-14 min-w-14 cursor-pointer rounded-xl px-3 font-bold text-ink-2 hover:text-ink">
            Close
          </button>
        </div>
        <p role="status" aria-live="polite" aria-atomic="true" className="oat-label min-h-4">
          {status === 'error' ? 'Couldn’t draft lines. Type your own.' : status === 'drafting' ? 'Drafting three lines…' : ''}
        </p>

        <ul className="mt-3 space-y-2" aria-label="Tap a line to send it">
          {status === 'drafting' && !shown.length && [0, 1, 2].map((k) => <li key={k} aria-hidden className="imt-skeleton h-16 rounded-full!" />)}
          {shown.map((o, k) => (
            <li key={`${o.kind}-${k}-${o.line}`}>
              <button ref={k === 0 ? firstChip : undefined} type="button" disabled={busy} onClick={() => sendAndClose(o.line)}
                aria-label={`${o.line}. Send to the table.`}
                className="min-h-16 w-full cursor-pointer rounded-[2rem] bg-card-2 px-6 py-3 text-left text-[1.176rem] leading-snug font-semibold text-ink transition-colors duration-150 hover:bg-[rgb(23_19_15/.09)] disabled:cursor-default disabled:opacity-50">
                {o.line}
              </button>
            </li>
          ))}
        </ul>

        <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) sendAndClose(custom); }}>
          <label htmlFor="imt-speak-custom" className="sr-only">Or type your own</label>
          <input id="imt-speak-custom" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={200}
            placeholder="Or type your own…" autoComplete="off"
            className="h-16 w-full rounded-xl border border-rule bg-cream px-4 text-[1.176rem] text-ink placeholder:text-ink-2" />
          <button type="submit" disabled={!custom.trim() || busy}
            className="h-16 w-full cursor-pointer rounded-full bg-amber text-[1.176rem] font-bold text-ink disabled:cursor-default disabled:opacity-40">Send to the table</button>
        </form>
        {status === 'waiting' && <p className="sr-only">Will speak within {MAX_WAIT_MS / 1000} seconds.</p>}
        {sent && <span className="sr-only" role="status">Sent: {sent.line}</span>}
        {line && <span className="sr-only">{line}</span>}
      </section>
    </>
  );
}
