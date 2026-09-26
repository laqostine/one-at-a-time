import { useEffect, useRef, useState } from 'react';
import { Loader2, Square, Volume2, X } from 'lucide-react';
import { IconSpeakForMe } from './icons';
import type { InterjectIntent } from '../../../shared/types';
import { MAX_WAIT_MS, type InterjectApi } from '../state/useInterject';
import { Button } from '@/components/ui/button';

interface Props {
  api: InterjectApi;
  /** Text-first: show the line on every joined phone (POST /api/room/say). Resolves to phones reached. */
  say?: (line: string) => Promise<number | null>;
  /** "Also say it aloud (synthetic voice)" pref. */
  voice?: boolean;
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
export function SpeakCard({ api, say, voice = true }: Props) {
  const [sent, setSent] = useState<{ line: string; delivered: number | null } | null>(null);
  // Always: the line goes to the phones first. Voice: only if the user opted in.
  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    if (say) {
      setSent({ line: t, delivered: null });
      void say(t).then((n) => setSent((cur) => (cur?.line === t ? { line: t, delivered: n } : cur)));
    }
    if (voice || !say) api.speakAtGap(t);
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
  useEffect(() => { if (open && status === 'ready' && options.length) firstChip.current?.focus(); }, [open, status, options]);

  const statusText =
    status === 'drafting' ? 'Drafting lines…'
    : status === 'waiting' ? 'Waiting for a gap…'
    : status === 'speaking' ? 'Speaking'
    : status === 'error' ? `Couldn't draft lines (${error}).`
    : status === 'ready' && open ? `${options.length} line${options.length === 1 ? '' : 's'} ready. Tap one to ${say ? 'show it on every phone' : 'say it at the next pause'}.`
    : '';

  if (!open) {
    return (
      <Button ref={openBtn} type="button" variant="outline" size="lg" onClick={openAndDraft} aria-keyshortcuts="S"
        className="w-full shrink-0 border-accent/45 text-accent hover:border-accent hover:bg-accent/10">
        <IconSpeakForMe size={22} /> Speak for me
        <kbd className="ml-1 hidden rounded-md border border-border px-1.5 py-0.5 text-[0.72rem] font-normal text-muted sm:inline">S</kbd>
      </Button>
    );
  }

  return (
    <section aria-label="Speak for me" className="imt-in shrink-0 rounded-2xl border border-accent/60 bg-card p-4 shadow-[var(--glow-accent)] sm:p-5">
      <div className="flex min-h-8 items-center gap-2 pb-3">
        <h2 className="card-label text-accent!">Speak for me</h2>
        <p role="status" aria-live="polite" aria-atomic="true"
          className={`ml-auto flex min-w-0 items-center gap-1.5 truncate text-[0.85rem] ${busy ? 'font-semibold text-warn' : status === 'error' ? 'text-bad' : 'text-muted'}`}>
          {(status === 'drafting' || status === 'waiting') && <Loader2 size={16} className="animate-spin" aria-hidden />}
          {status === 'speaking' && <Volume2 size={16} aria-hidden />}
          {statusText}
        </p>
        <button type="button" onClick={close} aria-label="Close Speak for me" className="-mr-2 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted transition-colors duration-150 hover:bg-card-2 hover:text-fg">
          <X size={20} aria-hidden />
        </button>
      </div>

      {sent && !busy && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-accent/50 bg-accent/10 px-4 py-2.5" role="status" aria-live="polite">
          <IconSpeakForMe size={22} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[0.7rem] tracking-wider text-accent uppercase">
              {sent.delivered == null ? 'Sending to phones…' : sent.delivered > 0 ? `On ${sent.delivered} phone${sent.delivered === 1 ? '' : 's'}` : 'No phones joined'}
            </span>
            <q className="text-body font-semibold">{sent.line}</q>
          </span>
        </div>
      )}
      {busy && line && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-warn/70 bg-warn/10 px-4 py-2.5">
          <q className="min-w-0 flex-1 text-body-lg font-semibold">{line}</q>
          <button type="button" onClick={api.stop} aria-label="Stop speaking"
            className="flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-bad px-4 text-[1rem] font-bold text-black transition-[filter] duration-150 hover:brightness-110">
            <Square size={16} aria-hidden /> Stop
          </button>
        </div>
      )}
      {status === 'waiting' && <p className="sr-only">Will speak within {MAX_WAIT_MS / 1000} seconds.</p>}

      {status === 'drafting' && !options.length && (
        <div className="space-y-2" aria-hidden>{[88, 72, 80].map((w) => <div key={w} className="imt-skeleton h-13" style={{ width: `${w}%` }} />)}</div>
      )}

      {options.length > 0 && (
        <ul className="space-y-2" aria-label="Lines to say">
          {options.map((o, k) => (
            <li key={`${o.kind}-${k}-${o.line}`}>
              <button ref={k === 0 ? firstChip : undefined} type="button" disabled={busy} onClick={() => send(o.line)}
                aria-label={`${o.label}: ${o.line}. ${say ? (voice ? 'Show on every phone and say it at the next pause.' : 'Show on every phone.') : 'Say it at the next pause.'}`}
                className="flex w-full cursor-pointer items-start gap-3 rounded-xl border border-border bg-card-2 px-3.5 py-3 text-left transition-colors duration-150 hover:border-accent disabled:cursor-default disabled:opacity-50">
                <span className="mt-0.5 inline-flex h-6 shrink-0 items-center rounded-full border border-accent/35 bg-accent/12 px-2 text-[0.72rem] font-semibold tracking-wide text-accent uppercase">{o.label}</span>
                <span className="text-body-lg">{o.line}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Draft a different kind of line">
        {INTENTS.map((i) => (
          <button key={i.intent} type="button" disabled={status === 'drafting' || busy} onClick={() => void api.draft(i.intent)}
            className="h-9 cursor-pointer rounded-full border border-border px-3.5 text-[0.88rem] font-medium text-muted transition-colors duration-150 hover:border-fg hover:text-fg disabled:cursor-default disabled:opacity-50">
            {i.label}
          </button>
        ))}
      </div>

      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) { send(custom); setCustom(''); } }}>
        <label htmlFor="imt-speak-custom" className="sr-only">Your own line</label>
        <input id="imt-speak-custom" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={200}
          placeholder="Type your own line…" autoComplete="off"
          className="h-12 min-w-0 flex-1 rounded-xl border border-input bg-card-2 px-3 text-[1.05rem] transition-colors duration-150 placeholder:text-muted focus:border-accent" />
        <button type="button" disabled={!custom.trim() || status === 'drafting' || busy} onClick={() => void api.draft('custom', custom)}
          className="h-12 cursor-pointer rounded-xl border border-border px-3 text-[0.95rem] font-medium text-muted transition-colors duration-150 hover:text-fg disabled:cursor-default disabled:opacity-50">Polish</button>
        <button type="submit" disabled={!custom.trim() || busy}
          className="h-12 cursor-pointer rounded-xl bg-accent px-4 text-[1rem] font-bold text-accent-fg transition-[filter] duration-150 hover:brightness-110 disabled:cursor-default disabled:opacity-50">Say it</button>
      </form>
    </section>
  );
}
