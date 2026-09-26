import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import type { CatchupState } from '../state/useSession';

interface Props {
  state: CatchupState;
  colorFor: (name?: string) => string;
  onBullet: (t: number) => void;
  onDismiss: () => void;
}

const FADE_MS = 15_000;

/** Static ≤3-bullet card overlaying the middle cards (no layout shift). */
export function CatchupCard({ state, colorFor, onBullet, onDismiss }: Props) {
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
      className={`absolute inset-0 z-10 flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 border-accent bg-card px-3 py-3 shadow-2xl transition-opacity duration-1000 ${fading ? 'opacity-30' : 'opacity-100'}`}>
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <h2 className="text-[0.75rem] font-semibold tracking-wider text-accent uppercase">You missed</h2>
        {state.status === 'ready' && (
          <span className="ml-auto text-[0.75rem] text-muted tabular-nums">
            as of {age}s ago · {(state.latencyMs / 1000).toFixed(1)}s · {state.data.confidence} confidence
          </span>
        )}
        <button type="button" onClick={(e) => { e.stopPropagation(); onDismiss(); }} aria-label="Dismiss catch-up"
          className="rounded-lg p-1 text-muted hover:text-fg"><X size={20} aria-hidden /></button>
      </div>

      {state.status === 'loading' && (
        <div className="space-y-3 px-1" aria-busy="true" aria-label="Loading catch-up">
          {[92, 78, 64].map((w) => <div key={w} className="imt-skeleton h-6" style={{ width: `${w}%` }} />)}
        </div>
      )}

      {state.status === 'error' && (
        <p className="px-1 text-[1.1rem] text-bad">Couldn't catch you up ({state.message}). Tap Catch me up to retry.</p>
      )}

      {state.status === 'ready' && (() => {
        const d = state.data;
        const a = d.addressed_to_me;
        const bullets = d.bullets.slice(0, 3);
        return (
          <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
            {a && (
              <p className="flex items-start gap-2 rounded-xl border-2 border-warn bg-warn/10 px-3 py-2 text-[1.15rem] leading-snug">
                <BellRing size={20} className="mt-1 shrink-0 text-warn" aria-hidden />
                <span><strong style={{ color: colorFor(a.speaker) }}>{a.speaker}</strong> asked you: <q>{a.question}</q></span>
              </p>
            )}
            {bullets.length ? (
              <ul className="space-y-1.5">
                {bullets.map((b, k) => {
                  const c = colorFor(b.speaker);
                  const inner = (
                    <>
                      <span aria-hidden className="mt-2 h-3 w-3 shrink-0 rounded-full" style={{ background: c }} />
                      <span className="min-w-0">
                        {b.thread && <span className="block truncate text-[0.75rem] text-muted">{b.thread}</span>}
                        <span className="text-[1.2rem] leading-snug">
                          {b.speaker && <strong style={{ color: c }}>{b.speaker}{b.replyTo ? <span className="font-normal text-muted"> to {b.replyTo}</span> : null}: </strong>}
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
                          className="flex w-full items-start gap-2.5 rounded-xl px-2 py-1 text-left hover:bg-card-2"
                          aria-label={`${b.thread ? `${b.thread}. ` : ''}${b.speaker ? `${b.speaker}${b.replyTo ? ` to ${b.replyTo}` : ''}: ` : ''}${b.text}. Show what was said.`}>{inner}</button>
                      ) : <div className="flex items-start gap-2.5 px-2 py-1">{inner}</div>}
                    </li>
                  );
                })}
              </ul>
            ) : !a && <p className="px-1 text-[1.1rem] text-muted">Nothing important since you last checked.</p>}
            {d.open_threads.length > 0 && (
              <p className="px-2 text-[0.9rem] text-muted">Still open: {d.open_threads.slice(0, 3).join(' · ')}</p>
            )}
          </div>
        );
      })()}
    </section>
  );
}
