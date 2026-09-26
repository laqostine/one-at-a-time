// "The table" (design/DESIGN.md addendum): the second page. Plans with reasons, what was asked of you,
// and the last catch-up. Plain typography, hairlines, no cards. Opened only by the listener.
import { useRef, useState, type ReactNode } from 'react';
import type { CatchupResponse, LedgerItem, LedgerKind } from '../../../shared/types';
import type { Nudge } from '../state/useSession';

const PREFIX: Partial<Record<LedgerKind, string>> = { objection: 'Pushback', open_question: 'Question', instruction_change: 'Changed' };

/** Plans: every decision (a resolved decision is a settled plan), plus pushback/questions/changes still open. */
export const openPlans = (ledger: LedgerItem[]) => ledger.filter((i) => i.kind !== 'assigned_to_me' && (i.kind === 'decision' || !i.resolved));

function because(reason?: string): string {
  const r = reason?.trim();
  if (!r) return '';
  if (/^because\b/i.test(r)) return r;
  // Lowercase a leading function word ("The oven…" -> "because the oven…"), never a name.
  const lower = /^(the|it|its|they|we|she|he|there|this|that|everyone|nobody|a|an|no|not|her|his|their|our)\b/i.test(r);
  return `because ${lower ? r.charAt(0).toLowerCase() + r.slice(1) : r}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-rule py-6" aria-label={title}>
      <h2 className="oat-label mb-4">{title}</h2>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="text-[1.06rem] text-ink-2">{children}</p>;

export function TablePage({ ledger, nudge, lastCatchup, missed: rolling, onAnswerNudge, onClose }: {
  ledger: LedgerItem[];
  nudge: Nudge | null;
  lastCatchup: { data: CatchupResponse; title?: string } | null;
  missed?: { data: CatchupResponse; at: number; sinceT: number } | null;
  onAnswerNudge: (label?: string) => void;
  onClose: () => void;
}) {
  const [answered, setAnswered] = useState<Set<string>>(() => new Set());
  const scroller = useRef<HTMLDivElement>(null);
  const touchY = useRef<number | null>(null);

  const plans = openPlans(ledger);
  const asked: { id: string; speaker: string; text: string; live: boolean }[] = [
    ...(nudge ? [{ id: `n-${nudge.id}`, speaker: nudge.speaker, text: nudge.question, live: true }] : []),
    ...ledger.filter((i) => i.kind === 'assigned_to_me' && !i.resolved)
      .filter((i) => !nudge || i.text.trim() !== nudge.question.trim())
      .map((i) => ({ id: i.id, speaker: i.speaker ?? 'Someone', text: i.text, live: false })),
  ].filter((a) => !answered.has(a.id)).slice(-3);
  const answer = (a: (typeof asked)[number], label?: string) => {
    setAnswered((s) => new Set(s).add(a.id));
    onAnswerNudge(label);
  };

  // The rolling catch-up (refreshed every 10 s) wins; the last manual catch-up is the fallback.
  const rollingLines = rolling ? rolling.data.bullets.map((b) => ({ speaker: b.speaker, text: b.text })).slice(0, 3) : [];
  const missedTitle = rolling && rollingLines.length
    ? `Since you looked away · updated ${Math.max(0, Math.round((Date.now() - rolling.at) / 1000))}s ago`
    : lastCatchup?.title ?? 'Since you looked away';
  const missed = rollingLines.length ? rollingLines : lastCatchup ? [
    ...(lastCatchup.data.addressed_to_me ? [{ speaker: lastCatchup.data.addressed_to_me.speaker, text: lastCatchup.data.addressed_to_me.question }] : []),
    ...lastCatchup.data.bullets.map((b) => ({ speaker: b.speaker, text: b.text })),
  ].slice(0, 3) : [];

  return (
    <div role="dialog" aria-modal="true" aria-label="The table" className="oat-up fixed inset-0 z-50 bg-cream text-ink"
      onTouchStart={(e) => { touchY.current = (scroller.current?.scrollTop ?? 0) <= 0 ? e.touches[0].clientY : null; }}
      onTouchEnd={(e) => { const y0 = touchY.current; touchY.current = null; if (y0 != null && e.changedTouches[0].clientY - y0 > 70) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div ref={scroller} className="mx-auto h-full max-w-[640px] overflow-y-auto px-5 pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <header className="flex items-start justify-between gap-3 pt-4 pb-5">
          <div>
            <button type="button" onClick={onClose} autoFocus aria-label="Back to the sentence"
              className="-mx-1 -my-2 cursor-pointer rounded-xl px-1 py-2 font-display-italic text-[18px] leading-none text-ink">One at a time</button>
            <p className="oat-label mt-1.5">The table</p>
          </div>
          <button type="button" onClick={onClose} className="-mt-3 -mr-3 h-14 min-w-14 cursor-pointer rounded-xl px-3 font-bold text-ink-2 hover:text-ink">Back</button>
        </header>

        <Section title="Plans">
          {plans.length ? (
            <ul className="space-y-5">
              {plans.map((i) => {
                const why = [i.speaker, because(i.reason)].filter(Boolean).join(' · ');
                return (
                  <li key={i.id} className={i.provisional ? 'opacity-75' : undefined}>
                    <p className="text-[1.176rem] leading-[1.35] font-semibold">
                      {PREFIX[i.kind] && <span className="oat-label mr-2 align-[0.12em] text-ink!">{PREFIX[i.kind]}</span>}
                      {i.text}
                    </p>
                    {why && <p className="mt-1 text-[1rem] leading-snug text-ink-2">{why}</p>}
                  </li>
                );
              })}
            </ul>
          ) : <Empty>No plans yet. They appear here as the table decides.</Empty>}
        </Section>

        <Section title="Asked of you">
          {asked.length ? (
            <ul className="space-y-6" aria-live="polite">
              {asked.map((a) => (
                <li key={a.id}>
                  <p className="text-[1.176rem] leading-[1.35]"><b>{a.speaker}:</b> {a.text}</p>
                  <div className="mt-3 flex gap-2">
                    {['Yes', 'Clarify', "Can't"].map((l) => (
                      <button key={l} type="button" onClick={() => answer(a, l)}
                        className="h-14 flex-1 cursor-pointer rounded-full bg-card-2 text-[1.06rem] font-bold text-ink">{l}</button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty>Nothing asked of you.</Empty>}
        </Section>

        <Section title={missedTitle}>
          {missed.length ? (
            <ul className="space-y-4">
              {missed.map((m, k) => <li key={k} className="text-[1.176rem] leading-[1.35]">{m.speaker && <b>{m.speaker}: </b>}{m.text}</li>)}
            </ul>
          ) : <Empty>Nothing yet. Tap “What did I miss?” on the first page.</Empty>}
        </Section>
      </div>
    </div>
  );
}
