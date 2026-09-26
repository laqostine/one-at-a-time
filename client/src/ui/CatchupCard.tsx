import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { IconCatchUp, IconForYou } from './icons';
import type { CatchupState } from '../state/useSession';
import { Badge } from '@/components/ui/badge';
import { readable } from '@/lib/utils';

interface Props {
  state: CatchupState;
  /** Header override, e.g. "While you looked away (12s)". Defaults to "You missed". */
  title?: string;
  colorFor: (name?: string) => string;
  onBullet: (t: number) => void;
  onDismiss: () => void;
  /** 'note' (phone): a paper note sliding onto the placemat. Default: paper over the middle dishes. */
  variant?: 'overlay' | 'note';
}

const FADE_MS = 15_000;

/** Static ≤3-bullet card overlaying the middle cards (no layout shift). */
export function CatchupCard({ state, colorFor, onBullet, onDismiss, title, variant = 'overlay' }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (state.status === 'idle') return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state.status]);

  const readyAt = state.status === 'ready' || state.status === 'error' ? state.at : null;
  useEffect(() => { setPaused(false); }, [readyAt]);
  useEffect(() => {
    if (readyAt == null || paused) return;
    const id = window.setTimeout(onDismiss, Math.max(0, FADE_MS - (Date.now() - readyAt)));
    return () => window.clearTimeout(id);
  }, [readyAt, paused, onDismiss]);

  if (state.status === 'idle') return null;
  const age = readyAt ? Math.max(0, Math.round((now - readyAt) / 1000)) : 0;
  const fading = readyAt != null && !paused && now - readyAt > FADE_MS - 2000;

  return (
    <section aria-label="Catch-up" aria-live="polite"
      onClick={onDismiss} onFocus={() => setPaused(true)} onMouseEnter={() => setPaused(true)}
      className={`paper absolute z-10 flex cursor-pointer flex-col overflow-hidden rounded-[6px_10px_8px_12px] p-4 shadow-[var(--shadow-sheet)] transition-opacity duration-200 sm:p-5 ${variant === 'note' ? 'imt-note-in deckle inset-x-1 top-2 bottom-1 rounded-none' : 'imt-in inset-0'} ${fading ? 'opacity-40' : 'opacity-100'}`}>
      <div className="flex min-h-8 items-center gap-2 pb-3">
        <h2 className="card-label flex items-center gap-1.5 text-accent!"><IconCatchUp size={16} strokeWidth={2} />{title ?? 'You missed'}</h2>
        {state.status === 'ready' && (
          <span className="ml-auto flex items-center gap-1.5 text-meta tabular-nums">
            <span className="hidden sm:inline">as of {age}s ago</span>
            <Badge variant="outline" className="text-muted">{(state.latencyMs / 1000).toFixed(1)}s</Badge>
            <Badge variant="outline" className="text-muted">{state.data.confidence}</Badge>
          </span>
        )}
        <button type="button" onClick={(e) => { e.stopPropagation(); onDismiss(); }} aria-label="Dismiss catch-up"
          className={`${state.status === 'ready' ? '' : 'ml-auto '}-mr-2 flex size-10 cursor-pointer items-center justify-center rounded-xl text-muted transition-colors duration-150 hover:bg-card-2 hover:text-fg`}><X size={20} aria-hidden /></button>
      </div>

      {state.status === 'loading' && (
        <div className="space-y-3 px-1" aria-busy="true" aria-label="Loading catch-up">
          {[92, 78, 64].map((w) => <div key={w} className="imt-skeleton h-7" style={{ width: `${w}%` }} />)}
        </div>
      )}

      {state.status === 'error' && (
        <p className="px-1 text-body text-bad">Couldn't catch you up ({state.message}). Tap Catch me up to retry.</p>
      )}

      {state.status === 'ready' && (() => {
        const d = state.data;
        const a = d.addressed_to_me;
        const bullets = d.bullets.slice(0, 3);
        return (
          <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
            {a && (
              <p className="flex items-start gap-3 rounded-xl bg-lamplight px-4 py-3 text-body-lg text-ink shadow-[var(--shadow-obj)]">
                <IconForYou size={24} className="mt-0.5 shrink-0 text-ink" />
                <span><strong>{a.speaker}</strong> asked <span className="underline decoration-you decoration-2 underline-offset-4">you</span>: <q>{a.question}</q></span>
              </p>
            )}
            {bullets.length ? (
              <ul className="space-y-1">
                {bullets.map((b, k) => {
                  const c = colorFor(b.speaker);
                  const inner = (
                    <>
                      <span aria-hidden className="w-1 shrink-0 self-stretch rounded-full" style={{ background: c || 'var(--line-strong)' }} />
                      <span className="min-w-0">
                        {b.thread && <span className="block truncate text-meta">{b.thread}</span>}
                        <span className="text-body-lg">
                          {b.speaker && <strong style={{ color: readable(c) }}>{b.speaker}{b.replyTo ? <span className="font-normal text-muted"> to {b.replyTo}</span> : null}: </strong>}
                          {b.kind === 'instruction_change' && <span className="font-semibold text-change">Changed: </span>}
                          {b.text}
                        </span>
                      </span>
                    </>
                  );
                  return (
                    <li key={k}>
                      {b.t != null ? (
                        <button type="button" onClick={(e) => { e.stopPropagation(); onBullet(b.t!); }}
                          className="flex w-full cursor-pointer items-stretch gap-3 rounded-xl px-2 py-1.5 text-left transition-colors duration-150 hover:bg-card-2"
                          aria-label={`${b.thread ? `${b.thread}. ` : ''}${b.speaker ? `${b.speaker}${b.replyTo ? ` to ${b.replyTo}` : ''}: ` : ''}${b.text}. Show what was said.`}>{inner}</button>
                      ) : <div className="flex items-stretch gap-3 px-2 py-1.5">{inner}</div>}
                    </li>
                  );
                })}
              </ul>
            ) : !a && <p className="px-1 text-body text-muted">Nothing important since you last checked.</p>}
            {d.open_threads.length > 0 && (
              <p className="mt-1 border-t border-border px-2 pt-2 text-meta">Still open: {d.open_threads.slice(0, 3).join(' · ')}</p>
            )}
          </div>
        );
      })()}
    </section>
  );
}
