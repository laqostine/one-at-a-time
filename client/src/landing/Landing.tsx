// Pitch landing (/landing.html). Static page; the only live object is the presence itself.
// Motion is CSS-only: an IntersectionObserver adds .is-in to .reveal elements (see index.css).
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { PresenceAuto } from '../ui/PresenceAuto';
import type { PresenceState } from '../ui/Presence';
import { ColorLegend } from '../ui/ColorLegend';
import { TableRing } from '../ui/TableRing';
import { PRESENCE_WORD, PRESENCE_HEX } from '../ui/presenceStates';
import {
  IconForYou, IconLedger, IconName, IconOverlap, IconPace, IconPhoneMic, IconReceipt, IconSpeakForMe, IconTable,
  IconDecision, IconObjection, IconQuestion, IconThread,
} from '../ui/icons';
import { cn } from '@/lib/utils';

const prefersReduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function useReveal() {
  useEffect(() => {
    if (!('IntersectionObserver' in window) || prefersReduced()) return;
    document.documentElement.classList.add('io');
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function useWide(q = '(min-width: 640px)') {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mm = window.matchMedia(q);
    const on = () => setM(mm.matches);
    mm.addEventListener('change', on);
    return () => mm.removeEventListener('change', on);
  }, [q]);
  return m;
}

/* ---------- hero presence: cycles through its states so the legend reads as real info ---------- */
const CYCLE: { state: PresenceState; ms: number; flare?: boolean }[] = [
  { state: 'listening', ms: 3200 },
  { state: 'transcribing', ms: 2600 },
  { state: 'thinking', ms: 2400 },
  { state: 'listening', ms: 1400, flare: true },
  { state: 'speaking', ms: 2600 },
];

function HeroPresence({ size }: { size: number }) {
  const [i, setI] = useState(0);
  const [level, setLevel] = useState(0);
  const [flare, setFlare] = useState(0);
  const [flaring, setFlaring] = useState(false);
  const reduce = prefersReduced();
  const step = CYCLE[i];

  useEffect(() => {
    if (reduce) return;
    const id = window.setTimeout(() => setI((n) => (n + 1) % CYCLE.length), step.ms);
    if (step.flare) { setFlare((f) => f + 1); setFlaring(true); }
    const off = window.setTimeout(() => setFlaring(false), 1800);
    return () => { window.clearTimeout(id); window.clearTimeout(off); };
  }, [i, step.ms, step.flare, reduce]);

  // A believable "voice" level for writing/speaking; 10 Hz is plenty and cheap.
  useEffect(() => {
    if (reduce || (step.state !== 'speaking' && step.state !== 'transcribing')) { setLevel(0); return; }
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      setLevel(Math.max(0, 0.35 + 0.3 * Math.sin(t * 9) + 0.2 * Math.sin(t * 23.7)));
    }, 100);
    return () => window.clearInterval(id);
  }, [step.state, reduce]);

  const state = reduce ? 'listening' : step.state;
  return (
    <div className="flex flex-col items-center">
      <PresenceAuto size={size} state={state} level={level} flare={flare} />
      <p className="mt-2 h-9 font-display-italic text-[1.7rem] leading-none transition-colors duration-500"
        style={{ color: flaring ? 'var(--warn)' : `color-mix(in oklab, ${PRESENCE_HEX[state]} 60%, var(--fg))` }} aria-hidden>
        {flaring ? 'Asked you' : PRESENCE_WORD[state]}
      </p>
      <ColorLegend current={state} flaring={flaring} className="mt-2 max-w-[22rem] justify-center" />
    </div>
  );
}

/* ---------- small building blocks ---------- */
function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/8 px-3 py-1 font-mono text-[0.68rem] font-medium tracking-[0.18em] text-accent uppercase', className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-accent" />{children}
    </span>
  );
}

function Reveal({ children, className, delay = 0, as: Tag = 'div' }: { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'li' | 'figure' }) {
  return <Tag className={cn('reveal', className)} style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}>{children}</Tag>;
}

const btnPrimary = 'inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent px-7 text-[1.05rem] font-bold text-accent-fg shadow-[var(--glow-accent)] transition-[filter,transform] duration-150 hover:brightness-110 active:translate-y-px';
const btnGhost = 'inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-line-strong px-7 text-[1.05rem] font-semibold text-fg transition-colors duration-150 hover:border-accent hover:bg-accent/8';

/* ---------- mock frames (CSS only, drawn from the real UI) ---------- */
function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="img" aria-label={label} className="relative mx-auto w-full max-w-[20rem] rounded-[1.6rem] border border-line-strong bg-bg p-3 shadow-[0_30px_60px_-30px_rgb(0_0_0/.8)]">
      <div aria-hidden className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-line" />
      <div aria-hidden>{children}</div>
    </div>
  );
}

function PaceMock() {
  return (
    <Frame label="A hearing participant's phone: the pace bar turns amber at 182 words per minute, 'A bit fast for Bera, slow down'.">
      <p className="wordmark text-[1rem]">I Missed That</p>
      <p className="mt-2 font-display-italic text-[1.7rem] leading-none">Alex</p>
      <div className="mt-3 rounded-2xl border-2 border-warn bg-card p-3.5">
        <div className="flex items-center gap-1.5 card-label"><IconPace size={14} strokeWidth={2} />Your pace</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-[2.6rem] leading-none font-bold text-warn tabular-nums">182</span>
          <span className="font-mono text-[0.7rem] text-muted">words / min</span>
        </div>
        <p className="mt-1.5 text-[0.95rem] leading-snug font-semibold">A bit fast for Bera, slow down</p>
        <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-card-2">
          <div className="h-full w-[83%] rounded-full bg-warn" />
          <span className="absolute top-0 h-full w-0.5 bg-bg/70" style={{ left: '68%' }} />
          <span className="absolute top-0 h-full w-1 bg-bg" style={{ left: '77%' }} />
        </div>
        <div className="relative mt-1 h-3 font-mono text-[0.6rem] text-muted">
          <span className="absolute -translate-x-1/2" style={{ left: '68%' }}>150</span>
          <span className="absolute -translate-x-1/2" style={{ left: '77%' }}>170</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-[0.8rem] font-semibold text-bad">
        <IconOverlap size={16} className="shrink-0" /> Two people talking at once
      </div>
    </Frame>
  );
}

function AskedMock() {
  return (
    <Frame label="The For you card: an amber nudge, 'Alex asked you: can you own the demo Friday?', with Yes, Clarify and Can't.">
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="card-label">For you</div>
        <div className="imt-flash mt-2 rounded-xl border border-warn/70 bg-warn/10 px-3 py-2.5">
          <p className="flex items-start gap-2 text-[0.98rem] leading-snug">
            <IconForYou size={20} className="mt-0.5 shrink-0 text-warn" />
            <span><strong style={{ color: 'color-mix(in oklab, #F59E0B 70%, white)' }}>Alex</strong> asked you: <q className="font-semibold">can you own the demo Friday?</q></span>
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            {['Yes', 'Clarify', "Can't"].map((l) => <span key={l} className="rounded-lg bg-card-2 py-1.5 text-center text-[0.8rem] font-semibold">{l}</span>)}
          </div>
        </div>
      </div>
      <div className="mt-2 rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center gap-1.5 card-label"><IconThread size={13} strokeWidth={2} className="text-accent" />Ship date</div>
        <p className="mt-1.5 flex items-center gap-1.5 text-[0.85rem]"><span className="inline-flex items-center gap-1 rounded-full border border-bad/35 bg-bad/12 px-1.5 py-0.5 font-mono text-[0.6rem] text-bad uppercase"><IconObjection size={11} strokeWidth={2.2} />Objection</span> Sam: Monday, not Friday</p>
        <p className="mt-1 flex items-center gap-1.5 text-[0.85rem]"><span className="inline-flex items-center gap-1 rounded-full border border-accent/35 bg-accent/12 px-1.5 py-0.5 font-mono text-[0.6rem] text-accent uppercase"><IconQuestion size={11} strokeWidth={2.2} />Question</span> Soft launch?</p>
      </div>
    </Frame>
  );
}

function SpeakMock() {
  return (
    <Frame label="Speak for me: a drafted line, 'Can we keep Monday as the fallback?', waiting for a gap in the conversation.">
      <div className="rounded-2xl border border-accent/60 bg-card p-3 shadow-[var(--glow-accent)]">
        <div className="flex items-center gap-2">
          <span className="card-label text-accent!">Speak for me</span>
          <span className="ml-auto font-mono text-[0.68rem] font-semibold text-warn">waiting for a gap…</span>
        </div>
        <div className="mt-2.5 rounded-xl border border-warn/70 bg-warn/10 px-3 py-2">
          <q className="text-[0.98rem] font-semibold">Can we keep Monday as the fallback?</q>
        </div>
        {/* the gap meter: speech bars, then silence where the line will land */}
        <div className="mt-3 flex h-8 items-end gap-[3px]" aria-hidden>
          {[40, 70, 55, 85, 60, 30, 75, 50, 20, 8, 6, 6, 6, 6].map((h, k) => (
            <span key={k} className={cn('w-full rounded-sm', k < 9 ? 'bg-line-strong' : 'bg-accent/50')} style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[0.6rem] text-muted"><span>talking</span><span className="text-accent">gap → your line</span></div>
        <div className="mt-2.5 flex flex-wrap gap-1">
          {['Object', 'Ask', 'Repeat?', 'Agree'].map((l) => <span key={l} className="rounded-full border border-border px-2.5 py-1 text-[0.75rem] text-muted">{l}</span>)}
        </div>
      </div>
    </Frame>
  );
}

/* ---------- page ---------- */
const STATS = [
  { n: '51.9%', label: 'of deaf and hard-of-hearing viewers are frustrated with live captions.' },
  { n: '170', unit: 'wpm', label: 'where caption comprehension caps out. Live group speech runs 160–220.' },
  { n: '4%', label: 'of non-speech information, the laugh, the tone, who spoke, reaches captions.' },
  { n: '96%', label: 'of deaf children are born to hearing parents. The dinner table is where it starts.' },
];

const STEPS = [
  { Icon: IconPhoneMic, title: 'Phones', body: 'Everyone scans one QR. Each phone becomes its owner’s mic. Nothing to install.' },
  { Icon: IconName, title: 'Names', body: 'Every line carries a real name, not “Speaker 2”. No guessing who talked.' },
  { Icon: IconLedger, title: 'Ledger', body: 'Decisions, objections and open questions, in lanes per conversation. Held until resolved.' },
  { Icon: IconReceipt, title: 'Receipts', body: 'Catch me up gives you three lines with the verbatim quote one tap away. Proof, not a summary.' },
];

const SAMPLE_SEATS = [
  { id: 1, name: 'Alex', color: '#F59E0B', active: true },
  { id: 2, name: 'Sam', color: '#10B981', active: false },
  { id: 3, name: 'Priya', color: '#EC4899', active: false },
  { id: 4, name: 'Jo', color: '#8B5CF6', active: false },
];

export default function Landing() {
  useReveal();
  const wide = useWide();
  useEffect(() => { document.title = 'I Missed That · the other side of the table'; }, []);

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg text-fg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-accent-fg">Skip to content</a>

      {/* nav */}
      <header className="absolute inset-x-0 top-0 z-20">
        <nav aria-label="Main" className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href="/landing.html" className="wordmark text-[1.5rem] sm:text-[1.7rem]">I Missed That</a>
          <div className="flex items-center gap-1 sm:gap-2">
            <a href="/join.html" className="hidden h-11 items-center rounded-xl px-3 text-[0.95rem] font-semibold text-muted transition-colors hover:text-fg sm:inline-flex">Join a table</a>
            <a href="/" className="inline-flex h-11 items-center gap-2 rounded-xl border border-accent/40 px-4 text-[0.95rem] font-semibold text-accent transition-colors hover:bg-accent/10">Open the table</a>
          </div>
        </nav>
      </header>

      <main id="main">
        {/* HERO */}
        <section aria-labelledby="hero-h" className="relative flex min-h-dvh items-center pt-20 pb-14">
          <div aria-hidden className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(60rem 40rem at 72% 42%, rgb(141 182 255 / .10), transparent 60%), radial-gradient(40rem 30rem at 10% 90%, rgb(246 185 59 / .05), transparent 60%)' }} />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:gap-6">
            <div className="order-2 lg:order-1">
              <Label>For hard-of-hearing adults at hearing tables</Label>
              <h1 id="hero-h" className="mt-6 font-display text-[2.7rem] leading-[1.02] tracking-[-0.01em] sm:text-[4rem] lg:text-[4.6rem]">
                <span className="text-fg/80">Every accessibility tool puts the burden on the deaf person.</span>{' '}
                <em className="text-accent">We built the other side.</em>
              </h1>
              <p className="mt-6 max-w-xl text-[1.15rem] leading-relaxed text-muted sm:text-[1.3rem]">
                Transcription tells you what was said. <span className="text-fg">We tell you what you missed.</span>
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="/" className={btnPrimary}><IconTable size={22} strokeWidth={2} />Open the table</a>
                <a href="/join.html" className={btnGhost}><IconPhoneMic size={22} />Join a table</a>
              </div>
              <p className="mt-5 font-mono text-[0.72rem] tracking-wider text-muted uppercase">No wearables · phones only · nothing stored</p>
            </div>
            <div className="order-1 flex justify-center lg:order-2">
              <HeroPresence size={wide ? 320 : 240} />
            </div>
          </div>
        </section>

        {/* STATS */}
        <section aria-labelledby="stats-h" className="border-y border-line bg-card/40">
          <h2 id="stats-h" className="sr-only">The numbers</h2>
          <ul className="mx-auto grid max-w-6xl grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((s, k) => (
              <Reveal as="li" key={s.n} delay={k * 90} className="bg-bg px-6 py-8 sm:px-8 sm:py-10">
                <p className="font-display text-[3.4rem] leading-none text-fg">{s.n}{s.unit && <span className="ml-1.5 font-mono text-[1rem] text-accent">{s.unit}</span>}</p>
                <p className="mt-3 max-w-[18rem] text-[1rem] leading-snug text-muted">{s.label}</p>
              </Reveal>
            ))}
          </ul>
          <p className="mx-auto max-w-6xl px-6 py-3 font-mono text-[0.66rem] tracking-wide text-muted sm:px-8">Sources: DHH caption-user surveys, caption-rate studies, the Dinner Table Syndrome literature (research/05 in the repo).</p>
        </section>

        {/* THREE MOMENTS */}
        <section aria-labelledby="moments-h" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <Reveal>
            <Label>Three moments</Label>
            <h2 id="moments-h" className="mt-4 max-w-3xl font-display text-[2.4rem] leading-[1.05] sm:text-[3.4rem]">
              A table is a contract between everyone at it. <em className="text-accent">The app is the clerk.</em>
            </h2>
          </Reveal>
          <ol className="mt-14 grid gap-6 lg:grid-cols-3">
            {[
              { n: '01', title: 'Everyone joins.', body: 'Hearing people’s phones show a pace bar. Over 170 words a minute or talking over each other, it turns amber. Nobody has to ask anyone to slow down.', mock: <PaceMock /> },
              { n: '02', title: 'The question aimed at you.', body: 'When someone asks you something, it glows amber: the only interruption the app ever makes. The rest waits in the ledger.', mock: <AskedMock /> },
              { n: '03', title: 'Speak for me, in the next gap.', body: 'One tap drafts your line. The room hears it in the next silence, so you get back in without fighting for the floor.', mock: <SpeakMock /> },
            ].map((m, k) => (
              <Reveal as="li" key={m.n} delay={k * 120} className="flex flex-col rounded-3xl border border-line bg-card p-5 sm:p-6">
                <div className="flex min-h-[25rem] items-center rounded-2xl bg-[radial-gradient(closest-side,rgb(141_182_255/.08),transparent)] py-4">{m.mock}</div>
                <p className="mt-6 font-mono text-[0.72rem] tracking-[0.18em] text-accent">{m.n}</p>
                <h3 className="mt-1 text-[1.35rem] font-semibold">{m.title}</h3>
                <p className="mt-2 text-[1.02rem] leading-relaxed text-muted">{m.body}</p>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* CINEMATIC QUOTE */}
        <section aria-label="What it feels like" className="relative overflow-hidden border-y border-line bg-[#0e0d0b] py-28 sm:py-40">
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(50rem 26rem at 50% 110%, rgb(141 182 255 / .12), transparent 70%)' }} />
          <span aria-hidden className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 font-display text-[16rem] leading-none text-accent/10 select-none sm:text-[22rem]">“</span>
          <Reveal as="figure" className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
            <blockquote className="font-display-italic text-[1.9rem] leading-[1.18] text-fg sm:text-[3rem]">
              I’ve started just nodding along even when I have no idea what was decided… I smiled and agreed but I genuinely don’t know what I signed up for.
            </blockquote>
            <figcaption className="mt-8 flex flex-col items-center gap-1.5">
              <span className="font-mono text-[0.78rem] tracking-[0.16em] text-accent uppercase">r/deaf, 35 upvotes</span>
              <span className="text-[1rem] text-muted">28, first corporate job, hard of hearing.</span>
            </figcaption>
          </Reveal>
        </section>

        {/* HOW IT WORKS */}
        <section aria-labelledby="how-h" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
            <Reveal>
              <Label>How it works</Label>
              <h2 id="how-h" className="mt-4 max-w-2xl font-display text-[2.4rem] leading-[1.05] sm:text-[3.4rem]">
                Phones, names, a ledger, <em className="text-accent">receipts.</em>
              </h2>
            </Reveal>
            <Reveal delay={150} className="hidden items-center gap-4 rounded-2xl border border-line bg-card px-5 py-4 lg:flex">
              <TableRing seats={SAMPLE_SEATS} source="phones" size={104} />
              <p className="max-w-[14rem] text-[0.95rem] leading-snug text-muted">The table ring: who joined, where you sit, who is talking right now.</p>
            </Reveal>
          </div>
          <ol className="relative mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            <span aria-hidden className="absolute top-7 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-transparent via-line-strong to-transparent lg:block" />
            {STEPS.map((s, k) => (
              <Reveal as="li" key={s.title} delay={k * 110} className="relative rounded-2xl border border-line bg-card p-5 lg:mx-2 lg:border-0 lg:bg-transparent lg:p-3 lg:text-center">
                <span className="relative inline-flex size-14 items-center justify-center rounded-2xl border border-accent/35 bg-bg text-accent shadow-[var(--glow-accent)] lg:mx-auto">
                  <s.Icon size={28} />
                </span>
                <p className="mt-4 font-mono text-[0.7rem] tracking-[0.18em] text-muted">0{k + 1}</p>
                <h3 className="mt-1 text-[1.3rem] font-semibold">{s.title}</h3>
                <p className="mt-2 text-[1rem] leading-relaxed text-muted">{s.body}</p>
              </Reveal>
            ))}
          </ol>
          <Reveal className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[0.72rem] tracking-wide text-muted">
            <span className="inline-flex items-center gap-1.5"><IconDecision size={16} className="text-good" />decision</span>
            <span className="inline-flex items-center gap-1.5"><IconObjection size={16} className="text-bad" />objection</span>
            <span className="inline-flex items-center gap-1.5"><IconQuestion size={16} className="text-accent" />open question</span>
            <span className="inline-flex items-center gap-1.5"><IconForYou size={16} className="text-warn" />for you</span>
            <span className="inline-flex items-center gap-1.5"><IconSpeakForMe size={16} className="text-accent" />speak for me</span>
          </Reveal>
        </section>

        {/* CLOSER */}
        <section aria-labelledby="close-h" className="border-t border-line">
          <Reveal className="mx-auto flex max-w-4xl flex-col items-center px-5 py-24 text-center sm:py-28">
            <h2 id="close-h" className="font-display text-[2.3rem] leading-[1.08] sm:text-[3.4rem]">
              Transcription tells you what was said. <em className="text-accent">We tell you what you missed.</em>
            </h2>
            <div className="mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
              <a href="/" className={btnPrimary}><IconTable size={22} strokeWidth={2} />Open the table</a>
              <a href="/join.html" className={btnGhost}><IconPhoneMic size={22} />Join a table</a>
            </div>
          </Reveal>
        </section>
      </main>

      {/* SCOPE FOOTER */}
      <footer className="border-t border-line bg-card/50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1fr_2fr]">
          <div>
            <p className="wordmark text-[1.6rem]">I Missed That</p>
            <p className="mt-2 text-[0.95rem] text-muted">The other side of the table.</p>
          </div>
          <div>
            <h2 className="card-label">Honest scope</h2>
            <ul className="mt-3 space-y-2.5 text-[1rem] leading-relaxed text-muted">
              <li><span className="text-fg">Built for spoken-language tables:</span> hard-of-hearing and late-deafened adults among hearing people, at work meetings and family dinners.</li>
              <li><span className="text-fg">Sign-first Deaf users need a different tool.</span> Interpreters and signing spaces, not captions. We don’t pretend otherwise.</li>
              <li><span className="text-fg">Nothing stored.</span> Audio lives in memory for 15 minutes on the table’s own session, then it’s gone.</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
