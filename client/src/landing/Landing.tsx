// Pitch landing (/landing.html). Static page; the only live object is the presence itself.
// Motion is CSS-only: an IntersectionObserver adds .is-in to .reveal elements (see index.css).
import { Fragment, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { PresenceAuto } from '../ui/PresenceAuto';
import type { PresenceState } from '../ui/Presence';
import { ColorLegend } from '../ui/ColorLegend';
import { TableRing } from '../ui/TableRing';
import { PRESENCE_WORD, PRESENCE_HEX } from '../ui/presenceStates';
import {
  IconForYou, IconLedger, IconName, IconPhoneMic, IconReceipt, IconSpeakForMe, IconTable,
  IconDecision, IconObjection, IconQuestion, IconLaugh, IconLamp, IconMug, IconChanged,
} from '../ui/icons';
import { ObjIcon, type ObjName } from '../ui/ObjIcon';
import { HouseRules } from '../ui/HouseRules';
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

function HeroPresence({ size, legend = true }: { size: number; legend?: boolean }) {
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
      {legend && <p className="mt-2 h-9 font-display-italic text-[1.7rem] leading-none transition-colors duration-500"
        style={{ color: flaring ? 'var(--warn)' : `color-mix(in oklab, ${PRESENCE_HEX[state]} 60%, var(--fg))` }} aria-hidden>
        {flaring ? 'Asked you' : PRESENCE_WORD[state]}
      </p>}
      {legend && <ColorLegend current={state} flaring={flaring} className="mt-2 max-w-[22rem] justify-center" />}
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

function LampMock() {
  return (
    <Frame label="Joyce's phone lying face-up on the table: a green lamp, 'Good pace for Bera', and the house rules on the placemat edge.">
      <div className="overflow-hidden rounded-2xl p-3.5 text-left" style={{ background: 'radial-gradient(120% 70% at 50% 42%, #8fe6bd, #3fcf8e 55%, #2f9e6c)', color: '#06170e' }}>
        <p className="font-mono text-[0.6rem] font-semibold tracking-[0.16em] uppercase opacity-80">Your phone is your mic</p>
        <p className="font-display text-[2rem] leading-none">Joyce</p>
        <div className="mx-auto mt-4 size-24 rounded-full" style={{ background: 'radial-gradient(circle at 42% 36%, #fff, #b6f0d4 40%, #7fdcae 72%)', boxShadow: '0 0 0 8px rgb(255 255 255 / .16), 0 0 40px 8px #b6f0d4' }} />
        <p className="mt-3 text-center font-display-italic text-[2.1rem] leading-none">Good</p>
        <p className="mt-1 text-center text-[0.9rem] font-semibold">Good pace for Bera</p>
        <p className="linen mt-3 rounded-xl px-2 py-1.5 text-center text-[0.72rem] font-semibold">One at a time · Face Bera · Screen up</p>
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 font-mono text-[0.62rem] tracking-wide text-muted">
        <span className="size-2 rounded-full bg-[#3fcf8e]" />one voice
        <span className="size-2 rounded-full bg-[#f6b93b]" />two at once
        <span className="size-2 rounded-full bg-[#ff5d4d]" />too fast
      </div>
    </Frame>
  );
}

function AskedMock() {
  return (
    <Frame label="The Asked you dish: an amber nudge, 'Mom asked you: are you coming Sunday?', with Yes, Clarify and Can't.">
      <div className="dish rounded-2xl p-3">
        <div className="card-label text-warn!">Asked you</div>
        <div className="imt-flash mt-2 rounded-xl border border-warn/70 bg-warn/10 px-3 py-2.5">
          <p className="flex items-start gap-2 text-[0.98rem] leading-snug">
            <IconForYou size={20} className="mt-0.5 shrink-0 text-warn" />
            <span><strong style={{ color: 'color-mix(in oklab, #3B82F6 70%, white)' }}>Mom</strong> asked you: <q className="font-semibold">are you coming Sunday?</q></span>
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            {['Yes', 'Clarify', "Can't"].map((l) => <span key={l} className="rounded-lg bg-card-2 py-1.5 text-center text-[0.8rem] font-semibold">{l}</span>)}
          </div>
        </div>
      </div>
      <div className="dish mt-2 rounded-2xl p-3">
        <div className="card-label text-[#efd6b5]!">Plans</div>
        <p className="mt-1.5 flex items-start gap-2 text-[0.88rem] leading-snug"><IconDecision size={16} className="mt-0.5 shrink-0 text-good" /><span>Sunday at one, at our place<span className="block text-[0.72rem] text-muted italic">because ours has the bigger table</span></span></p>
        <p className="mt-1.5 flex items-start gap-2 text-[0.88rem] leading-snug"><IconObjection size={16} className="mt-0.5 shrink-0 text-bad" /><span>Joyce: not the turkey again</span></p>
      </div>
    </Frame>
  );
}

function LaughMock() {
  return (
    <Frame label="Why they laughed: 'The table laughed at Mom: the smoke alarm went off for twenty minutes.'">
      <div className="dish rounded-2xl p-3.5">
        <div className="flex items-center gap-2 card-label text-[#efd6b5]!"><IconLaugh size={16} strokeWidth={2} className="text-[#edbc8f]" />Why they laughed</div>
        <p className="mt-3 text-[0.78rem] text-muted">The table laughed at <strong style={{ color: 'color-mix(in oklab, #3B82F6 70%, white)' }}>Mom</strong>, 3s ago:</p>
        <q className="mt-1 block font-display text-[1.45rem] leading-[1.12]">Don’t remind me, the smoke alarm went off for twenty minutes.</q>
        <p className="mt-3 border-t border-line/70 pt-2 text-[0.78rem] text-muted">Dad: We still call it the fire drill Thanksgiving.</p>
      </div>
    </Frame>
  );
}

function HeroLegend() {
  return <ColorLegend className="mt-3 justify-center" />;
}

/* ---------- the hero scene: a pendant lamp over the family table (v0 j3Vmfa0IsRr) with the mascot at the head ---------- */
const HERO_SEATS = [
  { name: 'Mom', color: '#3B82F6', x: '14%', y: '58%', r: -5, on: true },
  { name: 'Dad', color: '#F59E0B', x: '82%', y: '54%', r: 4 },
  { name: 'Joyce', color: '#10B981', x: '70%', y: '84%', r: -3 },
  { name: 'Bera', color: '#8db6ff', x: '30%', y: '86%', r: 3, you: true },
];

function TableScene({ wide }: { wide: boolean }) {
  return (
    <div className="relative mx-auto aspect-[6/5] w-full max-w-[36rem]" aria-hidden>
      {/* wire, shade, bulb glow, light cone, dust */}
      <div className="absolute top-0 left-1/2 h-[9%] w-px -translate-x-1/2 bg-[#5d4a39]" />
      <div className="absolute top-[8.5%] left-1/2 z-20 h-[7%] w-[22%] -translate-x-1/2 rounded-t-[60%] rounded-b-[12%] bg-gradient-to-b from-[#3a2c22] to-[#1d1611] shadow-[0_10px_18px_rgb(246_184_102/.28)]" />
      <div className="absolute top-[15%] left-1/2 z-20 h-[2%] w-[9%] -translate-x-1/2 rounded-[50%] bg-[#ffd28c] shadow-[0_0_28px_12px_rgb(255_186_94/.7)]" />
      <div className="absolute top-[15%] left-1/2 h-[62%] w-[92%] -translate-x-1/2 blur-[10px]"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgb(255 207 131 / .34) 0%, rgb(245 170 82 / .13) 32%, transparent 70%)', clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)' }} />
      <div className="absolute inset-0 opacity-30"
        style={{ backgroundImage: 'radial-gradient(circle, rgb(255 225 174 / .8) 0 1px, transparent 1.5px)', backgroundSize: '83px 71px', maskImage: 'linear-gradient(180deg, transparent, black 25%, transparent 80%)' }} />
      {/* the mascot sits at the head of the table (behind the far edge) */}
      <div className="absolute top-[38%] left-1/2 z-[5] -translate-x-1/2 -translate-y-1/2"><HeroPresence size={wide ? 150 : 110} legend={false} /></div>
      {/* the table, seen at a slight angle */}
      <div className="wood absolute top-[46%] left-[4%] z-10 h-[44%] w-[92%] rounded-[50%]">
        <div className="absolute inset-[5%] rounded-[50%] border border-[#e8aa67]/25" />
        {/* the placemat with the sentence */}
        <div className="linen absolute top-[30%] left-1/2 w-[46%] -translate-x-1/2 rotate-[-1.5deg] rounded-[46%_54%_50%_48%/14%_12%_14%_12%] px-3 py-2 text-center">
          <p className="font-display text-[clamp(0.8rem,1.6vw,1.1rem)] leading-tight text-ink">“Sunday at one, everyone brings a side.”</p>
        </div>
        <div className="absolute top-[10%] left-[24%]"><ObjIcon name="mug" fallback={IconMug} size={wide ? 64 : 44} /></div>
      </div>
      {/* glowing phone place cards */}
      {HERO_SEATS.map((p) => (
        <div key={p.name} className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: p.x, top: p.y, rotate: `${p.r}deg` }}>
          <div className={cn('rounded-xl border px-2.5 py-1 text-[0.85rem] font-semibold whitespace-nowrap sm:px-3.5 sm:py-1.5 sm:text-[1.05rem]', p.you ? 'border-accent/60 bg-[#1b1916]/95 text-accent' : 'bg-[#231915]/92 text-fg')}
            style={{ borderColor: p.you ? undefined : `color-mix(in oklab, ${p.color} ${p.on ? 80 : 40}%, transparent)`, boxShadow: p.on ? `0 0 0 3px color-mix(in oklab, ${p.color} 22%, transparent), 0 0 26px color-mix(in oklab, ${p.color} 60%, transparent)` : '0 10px 18px -8px rgb(0 0 0 / .7)' }}>
            <span className="mr-1.5 inline-block size-2.5 rounded-full" style={{ background: p.color }} />{p.name}{p.you && <span className="ml-1.5 font-mono text-[0.6rem] tracking-[0.14em] text-muted uppercase">you</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Warm multi-layer glow for one headline phrase. Filter values ported from 21st.dev @efferd/illuminated-hero. */
function GlowFilter() {
  const layers: [string, number, string, number][] = [
    ['b4', 4, '1 0 0 0 0  0 0.98 0 0 0  0 0 0.96 0 0  0 0 0 0.8 0', 0],
    ['b19', 19, '0.82 0 0 0 0  0 0.49 0 0 0  0 0 0.26 0 0  0 0 0 1 0', 2],
    ['b9', 9, '1 0 0 0 0  0 0.67 0 0 0  0 0 0.36 0 0  0 0 0 0.65 0', 2],
    ['b30', 30, '1 0 0 0 0  0 0.61 0 0 0  0 0 0.39 0 0  0 0 0 1 0', 2],
    ['b30', 30, '0.42 0 0 0 0  0 0.2 0 0 0  0 0 0.11 0 0  0 0 0 1 0', 64],
  ];
  return (
    <svg aria-hidden className="absolute size-0">
      <defs>
        <filter id="imt-lamp-glow" colorInterpolationFilters="sRGB" x="-50%" y="-200%" width="200%" height="500%">
          {[4, 9, 19, 30].map((d) => <feGaussianBlur key={d} in="SourceGraphic" stdDeviation={d} result={`b${d}`} />)}
          {layers.map(([src, , m, dy], k) => (
            <Fragment key={k}>
              <feColorMatrix in={src} type="matrix" values={m} result={`c${k}`} />
              <feOffset in={`c${k}`} dx="0" dy={dy} result={`o${k}`} />
            </Fragment>
          ))}
          <feMerge>{layers.map((_, k) => <feMergeNode key={k} in={`o${k}`} />)}<feMergeNode in="o0" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
    </svg>
  );
}

/* ---------- page ---------- */
const STATS = [
  { lead: 'About 50 million people', rest: ' in the EU say they have trouble hearing.', src: 'Eurostat-based estimate, EU27' },
  { lead: 'The place they most want to hear', rest: ' isn’t the office. It’s the family table.', src: 'At home with family 56%, workplace 21% (EuroTrak Italy)' },
  { lead: 'More than 90% of deaf children', rest: ' have hearing parents. The table is where it starts.', src: 'Mitchell & Karchmer 2004' },
];

const STEPS: { Icon: typeof IconPhoneMic; obj: ObjName; title: string; body: string }[] = [
  { Icon: IconPhoneMic, obj: 'phone', title: 'Phones', body: 'Everyone scans one QR and lays the phone on the table, screen up. It becomes their mic. Nothing to install.' },
  { Icon: IconName, obj: 'plate', title: 'Names', body: 'Every line carries a real name, Mom, Dad, Joyce, not “Speaker 2”.' },
  { Icon: IconLedger, obj: 'note', title: 'Plans', body: 'Plans with the why, pushback and questions, one lane per conversation at the table.' },
  { Icon: IconReceipt, obj: 'placemat', title: 'Receipts', body: 'Catch me up gives you three lines with the exact words one tap away.' },
];

const SAMPLE_SEATS = [
  { id: 1, name: 'Mom', color: '#3B82F6', active: true },
  { id: 2, name: 'Dad', color: '#F59E0B', active: false },
  { id: 3, name: 'Joyce', color: '#10B981', active: false },
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
        {/* HERO: a lamp-lit family table */}
        <section aria-labelledby="hero-h" className="relative flex min-h-dvh items-center overflow-hidden pt-20 pb-14">
          <div aria-hidden className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(60rem 40rem at 70% 40%, rgb(255 207 131 / .09), transparent 60%), radial-gradient(120% 90% at 50% 40%, transparent 55%, rgb(0 0 0 / .45))' }} />
          <GlowFilter />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-6">
            <div className="order-2 lg:order-1">
              <Label>For hard-of-hearing adults at the family table</Label>
              <h1 id="hero-h" className="mt-6 font-display text-[2.6rem] leading-[1.02] tracking-[-0.01em] sm:text-[3.8rem] lg:text-[4.3rem]">
                <span className="text-fg/80">Every accessibility tool puts the burden on the deaf person.</span>{' '}
                <em className="text-[#ffd9a0] [filter:url(#imt-lamp-glow)]">We built the other side.</em>
              </h1>
              <p className="mt-6 max-w-xl text-[1.15rem] leading-relaxed text-muted sm:text-[1.3rem]">
                Transcription tells you what was said. <span className="text-fg">We tell you what you missed.</span> Sunday lunch, Thursday standup: any table.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a href="/?replay=demo2" className={btnPrimary}><IconLamp size={22} strokeWidth={2} />Watch Sunday lunch</a>
                <a href="/" className={btnGhost}><ObjIcon name="table" fallback={IconTable} size={36} className="-my-2 -ml-2" />Start a table</a>
              </div>
              <p className="mt-5 font-mono text-[0.72rem] tracking-wider text-muted uppercase">No wearables · phones on the table · nothing stored</p>
            </div>
            <div className="order-1 lg:order-2">
              <TableScene wide={wide} />
              <HeroLegend />
            </div>
          </div>
        </section>

        {/* STATS: printed on linen */}
        <section aria-labelledby="stats-h" className="linen shadow-none!">
          <h2 id="stats-h" className="sr-only">The numbers</h2>
          <ul className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-12 sm:px-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-ink/20">
            {STATS.map((st, k) => (
              <Reveal as="li" key={st.lead} delay={k * 90} className="md:px-8 md:first:pl-0">
                <p className="font-display text-[1.9rem] leading-[1.12] text-ink"><span className="text-[#9a3f1c]">{st.lead}</span>{st.rest}</p>
                <p className="mt-3 font-mono text-[0.7rem] tracking-wide text-ink-muted uppercase">{st.src}</p>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* HOUSE RULES: the contract */}
        <section aria-labelledby="rules-h" className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-24 sm:px-6 sm:pt-32 lg:grid-cols-[1.1fr_1fr]">
          <Reveal>
            <Label>The contract</Label>
            <h2 id="rules-h" className="mt-4 max-w-2xl font-display text-[2.4rem] leading-[1.05] sm:text-[3.4rem]">
              A table is a contract between everyone at it. <em className="text-[#ffd9a0]">The lamp keeps it, so she never has to.</em>
            </h2>
            <p className="mt-5 max-w-xl text-[1.1rem] leading-relaxed text-muted">Three house rules, on the host’s placemat before anyone speaks and on every phone that joins. When two people talk at once, every phone glows amber. Nobody has to say “one at a time” for the hundredth time.</p>
          </Reveal>
          <Reveal delay={120} className="relative mx-auto w-full max-w-md">
            <div aria-hidden className="absolute -top-10 -right-4 hidden sm:block"><ObjIcon name="lamp" fallback={IconLamp} size={150} /></div>
            <HouseRules host="Bera" className="relative p-7!" />
          </Reveal>
        </section>

        {/* THREE MOMENTS */}
        <section aria-labelledby="moments-h" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <Reveal>
            <Label>At the table</Label>
            <h2 id="moments-h" className="mt-4 max-w-3xl font-display text-[2.4rem] leading-[1.05] sm:text-[3.4rem]">
              Three moments at <em className="text-[#ffd9a0]">Sunday lunch.</em>
            </h2>
          </Reveal>
          <ol className="mt-14 grid gap-6 lg:grid-cols-3">
            {[
              { n: '01', title: 'Phones on the table, screen up.', body: 'Each phone is its owner’s mic and a lamp. Green: one voice. Amber: two at once. Red: too fast. The hearing people see it, not you.', mock: <LampMock />, obj: <ObjIcon name="lamp" fallback={IconLamp} size={96} /> },
              { n: '02', title: 'Mom asked you.', body: 'A question aimed at you rings amber: the only interruption the app ever makes. The plans, with the why, wait on their dish.', mock: <AskedMock />, obj: <ObjIcon name="bell" fallback={IconForYou} size={96} /> },
              { n: '03', title: 'Why they laughed.', body: 'When the table laughs, the line that got the laugh lands on your screen. You get the joke three seconds late, instead of never.', mock: <LaughMock />, obj: <ObjIcon name="popper" fallback={IconLaugh} size={96} /> },
            ].map((m, k) => (
              <Reveal as="li" key={m.n} delay={k * 120} className="flex flex-col rounded-3xl border border-line bg-card p-5 sm:p-6">
                <div className="flex min-h-[25rem] items-center rounded-2xl bg-[radial-gradient(closest-side,rgb(255_207_131/.08),transparent)] py-4">{m.mock}</div>
                <div className="mt-5 flex items-center gap-3">{m.obj}<p className="font-mono text-[0.72rem] tracking-[0.18em] text-accent">{m.n}</p></div>
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
                Phones, names, plans, <em className="text-accent">receipts.</em>
              </h2>
            </Reveal>
            <Reveal delay={150} className="hidden items-center gap-4 rounded-2xl border border-line bg-card px-5 py-4 lg:flex">
              <TableRing seats={SAMPLE_SEATS} source="phones" size={104} />
              <p className="max-w-[14rem] text-[0.95rem] leading-snug text-muted">The table ring: who joined, where you sit, who has the mug right now.</p>
            </Reveal>
          </div>
          <ol className="relative mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            <span aria-hidden className="absolute top-11 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-transparent via-line-strong to-transparent lg:block" />
            {STEPS.map((s, k) => (
              <Reveal as="li" key={s.title} delay={k * 110} className="relative rounded-2xl border border-line bg-card p-5 lg:mx-2 lg:border-0 lg:bg-transparent lg:p-3 lg:text-center">
                <span className="relative inline-flex lg:mx-auto"><ObjIcon name={s.obj} fallback={s.Icon} size={88} /></span>
                <p className="mt-4 font-mono text-[0.7rem] tracking-[0.18em] text-muted">0{k + 1}</p>
                <h3 className="mt-1 text-[1.3rem] font-semibold">{s.title}</h3>
                <p className="mt-2 text-[1rem] leading-relaxed text-muted">{s.body}</p>
              </Reveal>
            ))}
          </ol>
          <Reveal className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[0.72rem] tracking-wide text-muted">
            <span className="inline-flex items-center gap-1.5"><IconDecision size={16} className="text-good" />plan</span>
            <span className="inline-flex items-center gap-1.5"><IconObjection size={16} className="text-bad" />pushback</span>
            <span className="inline-flex items-center gap-1.5"><IconQuestion size={16} className="text-accent" />question</span>
            <span className="inline-flex items-center gap-1.5"><IconChanged size={16} className="text-change" />changed</span>
            <span className="inline-flex items-center gap-1.5"><IconForYou size={16} className="text-warn" />asked you</span>
            <span className="inline-flex items-center gap-1.5"><IconMug size={16} className="text-[#edbc8f]" />has the floor</span>
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
              <a href="/?replay=demo2" className={btnPrimary}><IconLamp size={22} strokeWidth={2} />Watch Sunday lunch</a>
              <a href="/" className={btnGhost}><ObjIcon name="table" fallback={IconTable} size={36} className="-my-2 -ml-2" />Start a table</a>
              <a href="/?replay=demo1" className={btnGhost}>Watch a standup</a>
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
            <p className="mt-4 font-mono text-[0.66rem] leading-relaxed tracking-wide text-muted">Numbers: EU ≈50M is our arithmetic from WHO Europe / Eurostat; 56% is EuroTrak Italy (n=1,317); &gt;90% is US data (Mitchell &amp; Karchmer 2004). research/09 in the repo.</p>
          </div>
          <div>
            <h2 className="card-label">Honest scope</h2>
            <ul className="mt-3 space-y-2.5 text-[1rem] leading-relaxed text-muted">
              <li><span className="text-fg">Built for spoken-language tables:</span> hard-of-hearing and late-deafened adults among hearing people: family meals first, then the standup.</li>
              <li><span className="text-fg">Sign-first Deaf users need a different tool.</span> Interpreters and signing spaces, not captions. We don’t pretend otherwise.</li>
              <li><span className="text-fg">Nothing stored.</span> Audio lives in memory for 15 minutes on the table’s own session, then it’s gone.</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
