// "The map" (third page): an Obsidian-like live graph of where the conversation went.
// Topics (threads) are ink rings, speakers are colored dots, the path between topics is a line with an arrow.
// Typography on cream; the only accent is amber (the current topic and the last turn). Own tiny force sim.
import { useEffect, useMemo, useRef, useState, useReducer } from 'react';
import type { LedgerItem, LedgerKind, Utterance } from '../../../shared/types';
import { matchThread } from '../../../shared/threads';
import { isUtt, speakerColor, speakerName, type SessionState } from '../state/session';
import { moodRing, speakerMood, type SpeakerMood } from '../lib/mood';

const RED = '#B4432F';
const KIND: Record<LedgerKind, string> = { decision: 'Plan', objection: 'Pushback', open_question: 'Question', assigned_to_me: 'Asked of you', instruction_change: 'Changed' };

/* ---------------- graph model (pure) ---------------- */

interface Topic { id: string; label: string; lines: number; order: number; ledger: LedgerItem[] }
interface Spk { id: number; name: string; color: string; mood: SpeakerMood; lines: number }
interface Graph {
  topics: Topic[]; speakers: Spk[];
  said: { sp: number; topic: string; n: number }[];      // speaker -> topic, n lines
  path: { from: string; to: string; n: number }[];         // topic transitions
  last: { from: string; to: string } | null;
  replies: { a: number; b: number }[];
  current: string | null; firstSpeakerTopic: Map<number, string>;
}

export function buildGraph(s: SessionState): Graph {
  const finals = s.timeline.filter((i): i is Utterance => isUtt(i) && i.final && !!i.text.trim()).sort((a, b) => a.tStart - b.tStart);
  const known = new Map(s.threads.map((t) => [t.id, t]));
  const topics = new Map<string, Topic>();
  const said = new Map<string, number>();
  const path = new Map<string, number>();
  const tones = new Map<number, Utterance['tone'][]>();
  const lines = new Map<number, number>();
  const firstSpeakerTopic = new Map<number, string>();
  let prev: string | null = null, last: Graph['last'] = null;
  for (const u of finals) {
    if (u.speaker !== -1) { (tones.get(u.speaker) ?? tones.set(u.speaker, []).get(u.speaker)!).push(u.tone); }
    const tid = u.threadId;
    if (!tid || !known.has(tid)) continue;
    if (!topics.has(tid)) topics.set(tid, { id: tid, label: known.get(tid)!.label, lines: 0, order: topics.size + 1, ledger: [] });
    topics.get(tid)!.lines++;
    if (u.speaker !== -1) {
      said.set(`${u.speaker}|${tid}`, (said.get(`${u.speaker}|${tid}`) ?? 0) + 1);
      lines.set(u.speaker, (lines.get(u.speaker) ?? 0) + 1);
      if (!firstSpeakerTopic.has(u.speaker)) firstSpeakerTopic.set(u.speaker, tid);
    }
    if (prev && prev !== tid) { const k = `${prev}|${tid}`; path.set(k, (path.get(k) ?? 0) + 1); last = { from: prev, to: tid }; }
    prev = tid;
  }
  for (const it of s.ledger) {
    const tid = it.threadId && topics.has(it.threadId) ? it.threadId : matchThread(it.thread, [...topics.values()]);
    if (tid && topics.has(tid)) topics.get(tid)!.ledger.push(it);
  }
  const speakers: Spk[] = [...lines.keys()].map((id) => ({
    id, name: speakerName(s, id), color: speakerColor(s, id), mood: speakerMood(tones.get(id) ?? []), lines: lines.get(id)!,
  }));
  const byName = new Map(speakers.map((p) => [p.name.toLowerCase(), p.id]));
  const replies: Graph['replies'] = [];
  const seen = new Set<string>();
  for (let k = finals.length - 1; k >= 0 && replies.length < 12; k--) {
    const u = finals[k];
    const b = u.replyTo ? byName.get(u.replyTo.trim().toLowerCase()) : undefined;
    if (b == null || !lines.has(u.speaker) || b === u.speaker) continue;
    const key = `${Math.min(u.speaker, b)}|${Math.max(u.speaker, b)}`;
    if (seen.has(key)) continue;
    seen.add(key); replies.push({ a: u.speaker, b });
  }
  return {
    topics: [...topics.values()], speakers,
    said: [...said].map(([k, n]) => { const [sp, topic] = k.split('|'); return { sp: Number(sp), topic, n }; }),
    path: [...path].map(([k, n]) => { const [from, to] = k.split('|'); return { from, to, n }; }),
    last, replies, current: prev, firstSpeakerTopic,
  };
}

/* ---------------- a small force simulation ---------------- */

interface Node { key: string; x: number; y: number; vx: number; vy: number; r: number; hit: number; pinned?: boolean }
interface Link { a: string; b: string; len: number; k: number }

const topicR = (n: number) => Math.min(46, 12 + 5 * Math.sqrt(n));
const topicFont = (n: number) => Math.min(24, 18 + n / 4);

function tick(nodes: Map<string, Node>, links: Link[], w: number, h: number, alpha: number) {
  const list = [...nodes.values()];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      if (!dx && !dy) { dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); }
      const d = Math.hypot(dx, dy);
      let f = (900 * alpha) / Math.max(d, 12);                    // repulsion
      const min = a.hit + b.hit;
      if (d < min) f += (min - d) * 0.22;                         // collision (labels need room)
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
    }
  }
  for (const l of links) {                                        // springs
    const a = nodes.get(l.a), b = nodes.get(l.b);
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy));
    const f = ((d - l.len) / d) * l.k * alpha;
    a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
  }
  for (const n of list) {                                         // centering + integrate + clamp
    if (n.pinned) { n.vx = n.vy = 0; continue; }
    n.vx += (w / 2 - n.x) * 0.006 * alpha; n.vy += (h / 2 - n.y) * 0.006 * alpha;
    n.vx *= 0.6; n.vy *= 0.6;
    n.x += n.vx; n.y += n.vy;
    const px = Math.min(n.hit, w / 2 - 8);
    n.x = Math.max(px, Math.min(w - px, n.x));
    n.y = Math.max(n.r + 26, Math.min(h - n.r - 40, n.y));
  }
}

/* ---------------- the page ---------------- */

function useThrottled<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  const last = useRef(0);
  useEffect(() => {
    const wait = Math.max(0, ms - (Date.now() - last.current));
    const id = window.setTimeout(() => { last.current = Date.now(); setV(value); }, wait);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function MapPage({ session, onClose }: { session: SessionState; onClose: () => void }) {
  const snap = useThrottled(session, 250);
  const g = useMemo(() => buildGraph(snap), [snap]);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 390, h: 560 });
  const nodes = useRef(new Map<string, Node>());
  const alpha = useRef(0);
  const raf = useRef(0);
  const [, render] = useReducer((n: number) => n + 1, 0);
  const [tip, setTip] = useState<LedgerItem | null>(null);
  const drag = useRef<{ key: string; id: number } | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const links = useMemo<Link[]>(() => [
    ...g.said.map((e) => ({ a: `s${e.sp}`, b: `t${e.topic}`, len: 78, k: 0.06 })),
    ...g.path.map((e) => ({ a: `t${e.from}`, b: `t${e.to}`, len: 170, k: 0.04 })),
  ], [g]);

  const run = () => {
    cancelAnimationFrame(raf.current);
    const loop = () => {
      tick(nodes.current, links, size.w, size.h, alpha.current);
      alpha.current *= 0.955;                               // ~1.5 s to settle at 60 fps
      render();
      if (alpha.current > 0.02 || drag.current) raf.current = requestAnimationFrame(loop);
    };
    if (reduced()) { for (let k = 0; k < 120; k++) { tick(nodes.current, links, size.w, size.h, alpha.current); alpha.current *= 0.955; } render(); return; }
    raf.current = requestAnimationFrame(loop);
  };

  // Sync nodes with the graph: new ones enter from the current topic, not a random corner.
  useEffect(() => {
    const m = nodes.current;
    const cur = g.current ? m.get(`t${g.current}`) : undefined;
    const origin = cur ?? { x: size.w / 2, y: size.h / 2 };
    const want = new Set<string>();
    const jitter = () => (Math.random() - 0.5) * 24;
    for (const t of g.topics) {
      const key = `t${t.id}`; want.add(key);
      const r = topicR(t.lines);
      const hw = Math.min(size.w / 2 - 8, Math.max(r + 8, t.label.length * topicFont(t.lines) * 0.26));
      const n = m.get(key);
      if (n) { n.r = r; n.hit = hw; } else m.set(key, { key, x: origin.x + jitter(), y: origin.y + jitter(), vx: 0, vy: 0, r, hit: hw });
    }
    for (const p of g.speakers) {
      const key = `s${p.id}`; want.add(key);
      if (!m.has(key)) {
        const from = m.get(`t${g.firstSpeakerTopic.get(p.id)}`) ?? origin;
        m.set(key, { key, x: from.x + jitter(), y: from.y + jitter(), vx: 0, vy: 0, r: 7, hit: 30 });
      }
    }
    for (const k of [...m.keys()]) if (!want.has(k)) m.delete(k);
    alpha.current = Math.max(alpha.current, 0.8);
    run();
    return () => cancelAnimationFrame(raf.current);
  }, [g, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const toLocal = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const dragProps = (key: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      drag.current = { key, id: e.pointerId };
      const n = nodes.current.get(key); if (n) n.pinned = true;
      alpha.current = Math.max(alpha.current, 0.3); run();
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (drag.current?.key !== key) return;
      const n = nodes.current.get(key); if (!n) return;
      const p = toLocal(e); n.x = p.x; n.y = p.y;
      alpha.current = Math.max(alpha.current, 0.3);
    },
    onPointerUp: () => {
      const n = nodes.current.get(key); if (n) n.pinned = false;
      drag.current = null; alpha.current = Math.max(alpha.current, 0.3); run();
    },
    onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
    onTouchEnd: (e: React.TouchEvent) => e.stopPropagation(),
  });

  const P = (key: string) => nodes.current.get(key);
  const topicById = new Map(g.topics.map((t) => [t.id, t]));
  const empty = g.topics.length === 0;

  return (
    <div role="dialog" aria-modal="true" aria-label="The map" className="oat-fade fixed inset-0 z-50 bg-cream text-ink"
      onTouchStart={(e) => { e.stopPropagation(); swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        e.stopPropagation();
        const s0 = swipe.current; swipe.current = null;
        if (!s0) return;
        const dx = e.changedTouches[0].clientX - s0.x, dy = e.changedTouches[0].clientY - s0.y;
        if (dx > 80 && Math.abs(dy) < 60) onClose();
      }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="mx-auto flex h-full max-w-[640px] flex-col px-5 pt-[env(safe-area-inset-top)] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <header className="flex shrink-0 items-start justify-between gap-3 pt-4 pb-2">
          <div>
            <button type="button" onClick={onClose} autoFocus aria-label="Back to the sentence"
              className="-mx-1 -my-2 cursor-pointer rounded-xl px-1 py-2 font-display-italic text-[18px] leading-none text-ink">One at a time</button>
            <p className="oat-label mt-1.5">The map</p>
          </div>
          <button type="button" onClick={onClose} className="-mt-3 -mr-3 h-14 min-w-14 cursor-pointer rounded-xl px-3 font-bold text-ink-2 hover:text-ink">Back</button>
        </header>

        <ul role="list" className="sr-only" aria-label="Topics, in the order they came up">
          {empty && <li>The map draws itself as people talk.</li>}
          {g.topics.map((t) => {
            const who = g.said.filter((e) => e.topic === t.id).map((e) => g.speakers.find((p) => p.id === e.sp)?.name).filter(Boolean);
            return (
              <li key={t.id}>
                {`Topic ${t.label}: ${t.lines} line${t.lines === 1 ? '' : 's'}, speakers ${who.join(', ') || 'unknown'}`}
                {t.id === g.current ? '. Current topic' : ''}
                {t.ledger.length ? `. ${t.ledger.map((i) => `${KIND[i.kind]}: ${i.text}${i.reason ? `, because ${i.reason}` : ''}`).join('. ')}` : ''}
              </li>
            );
          })}
          {g.speakers.filter((p) => p.mood !== 'neutral').map((p) => <li key={`m${p.id}`}>{`${p.name} sounds ${p.mood}`}</li>)}
        </ul>

        <div ref={box} className="relative min-h-0 flex-1 touch-none select-none" onClick={() => setTip(null)}>
          {empty ? (
            <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-display-italic text-[1.6rem] leading-tight text-ink-2">
              The map draws itself as people talk.
            </p>
          ) : (
            <svg width={size.w} height={size.h} aria-hidden className="absolute inset-0 overflow-visible">
              <defs>
                {(['ink', 'amber'] as const).map((c) => (
                  <marker key={c} id={`oat-arrow-${c}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto">
                    <path d="M0,1 L9,5 L0,9 z" fill={`var(--${c})`} />
                  </marker>
                ))}
              </defs>

              {/* speaker -> topic hairlines (width = their lines there) */}
              {g.said.map((e) => {
                const a = P(`s${e.sp}`), b = P(`t${e.topic}`);
                if (!a || !b) return null;
                return <line key={`w${e.sp}-${e.topic}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--rule)" strokeWidth={Math.min(6, 0.75 + 0.6 * e.n)} strokeLinecap="round" />;
              })}

              {/* reply links: dotted hairline between the two dots */}
              {g.replies.map((r) => {
                const a = P(`s${r.a}`), b = P(`s${r.b}`);
                if (!a || !b) return null;
                return <line key={`r${r.a}-${r.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="1 4" strokeLinecap="round" />;
              })}

              {/* the path between topics */}
              {g.path.map((e) => {
                const a = P(`t${e.from}`), b = P(`t${e.to}`);
                if (!a || !b) return null;
                const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy));
                const ux = dx / d, uy = dy / d;
                const x1 = a.x + ux * (a.r + 3), y1 = a.y + uy * (a.r + 3), x2 = b.x - ux * (b.r + 4), y2 = b.y - uy * (b.r + 4);
                const bend = 14, mx = (x1 + x2) / 2 - uy * bend, my = (y1 + y2) / 2 + ux * bend;
                const isLast = g.last?.from === e.from && g.last?.to === e.to;
                return <path key={`p${e.from}-${e.to}`} d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} fill="none"
                  stroke={isLast ? 'var(--amber)' : 'var(--ink)'} strokeWidth={isLast ? 2.5 : Math.min(3, 0.9 + 0.4 * (e.n - 1))}
                  markerEnd={`url(#oat-arrow-${isLast ? 'amber' : 'ink'})`} />;
              })}

              {/* topics */}
              {g.topics.map((t) => {
                const n = P(`t${t.id}`);
                if (!n) return null;
                const cur = t.id === g.current;
                const fs = topicFont(t.lines);
                return (
                  <g key={t.id} className="cursor-grab" {...dragProps(`t${t.id}`)}>
                    {cur && <circle cx={n.x} cy={n.y} r={n.r} fill="var(--amber)" className="oat-pulse" />}
                    <circle cx={n.x} cy={n.y} r={n.r} fill={cur ? 'var(--amber)' : 'var(--cream)'} stroke="var(--ink)" strokeWidth={1.25} />
                    <text x={n.x - n.r * 0.72 - 4} y={n.y - n.r * 0.72 - 2} textAnchor="end" fontFamily="'Space Mono', ui-monospace, monospace" fontSize={11} fill="var(--ink-2)">{t.order}</text>
                    <text x={n.x} y={n.y + n.r + fs + 2} textAnchor="middle" fontFamily="var(--font-display)" fontStyle="italic" fontWeight={500} fontSize={fs} fill="var(--ink)"
                      stroke="var(--cream)" strokeWidth={5} strokeLinejoin="round" paintOrder="stroke"
                      style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144' }}>{t.label}</text>
                    {t.ledger.slice(0, 8).map((it, k) => {
                      const ang = -Math.PI / 3 + k * (Math.PI / 9);
                      const c = Math.cos(ang), s = Math.sin(ang);
                      const r0 = n.r + 3, r1 = n.r + 11, rm = n.r + 8;
                      return (
                        <g key={it.id} className="cursor-pointer" onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); setTip((p) => (p?.id === it.id ? null : it)); }}>
                          <line x1={n.x + c * r0} y1={n.y + s * r0} x2={n.x + c * r1} y2={n.y + s * r1}
                            stroke={it.resolved && it.kind !== 'decision' ? 'var(--ink-2)' : 'var(--ink)'} strokeWidth={tip?.id === it.id ? 3 : 1.75} strokeLinecap="round" />
                          <circle cx={n.x + c * rm} cy={n.y + s * rm} r={11} fill="transparent" />
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* speakers */}
              {g.speakers.map((p) => {
                const n = P(`s${p.id}`);
                if (!n) return null;
                const ring = moodRing(p.mood);
                return (
                  <g key={p.id} className="cursor-grab" {...dragProps(`s${p.id}`)}>
                    <circle cx={n.x} cy={n.y} r={22} fill="transparent" />
                    {ring && <circle cx={n.x} cy={n.y} r={11} fill="none" stroke={ring} strokeWidth={2.5} />}
                    <circle cx={n.x} cy={n.y} r={7} fill={p.color} />
                    <text x={n.x} y={n.y + 28} textAnchor="middle" fontFamily="var(--font-sans)" fontWeight={700} fontSize={14} fill="var(--ink)" stroke="var(--cream)" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke">{p.name}</text>
                    {p.mood !== 'neutral' && (
                      <text x={n.x} y={n.y + 42} textAnchor="middle" fontFamily="'Space Mono', ui-monospace, monospace" fontSize={11} letterSpacing="0.14em"
                        fill={ring === RED ? RED : 'var(--ink-2)'}>{p.mood.toUpperCase()}</text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}

          {tip && (
            <div className="oat-fade absolute inset-x-0 bottom-0 border-t border-rule bg-cream pt-3" role="status" aria-live="polite"
              onClick={(e) => { e.stopPropagation(); setTip(null); }}>
              <p className="oat-label mb-1">{KIND[tip.kind]}{topicById.get(tip.threadId ?? '')?.label ? ` · ${topicById.get(tip.threadId ?? '')!.label}` : ''}</p>
              <p className="text-[1.06rem] leading-snug font-semibold">{tip.text}</p>
              {(tip.speaker || tip.reason) && <p className="mt-1 text-[1rem] leading-snug text-ink-2">{[tip.speaker, tip.reason && `because ${tip.reason.replace(/^because\s+/i, '')}`].filter(Boolean).join(' · ')}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
