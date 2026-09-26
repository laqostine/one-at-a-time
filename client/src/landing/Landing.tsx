// Pitch landing (/landing.html). Static page; the only live object is the presence itself.
// Motion is CSS-only: an IntersectionObserver adds .is-in to .reveal elements (see index.css).
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { TableRing } from '../ui/TableRing';
import {
  IconForYou, IconLedger, IconName, IconPhoneMic, IconReceipt, IconSpeakForMe, IconTable,
  IconDecision, IconObjection, IconQuestion, IconLaugh, IconLamp, IconMug, IconChanged,
} from '../ui/icons';
import { ObjIcon, type ObjName } from '../ui/ObjIcon';
import { HouseRules } from '../ui/HouseRules';
import { Wordmark } from '../ui/Wordmark';
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

/* ---------- small building blocks ---------- */
function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-mono text-[0.72rem] font-semibold tracking-[0.18em] text-accent uppercase', className)}>
      <span aria-hidden className="h-px w-6 bg-accent" />{children}
    </span>
  );
}

function Reveal({ children, className, delay = 0, as: Tag = 'div' }: { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'li' | 'figure' }) {
  return <Tag className={cn('reveal', className)} style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}>{children}</Tag>;
}

const btnPrimary = 'inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent px-7 text-[1.05rem] font-bold text-accent-fg shadow-[var(--shadow-obj)] transition-[filter,transform] duration-150 hover:brightness-110 active:translate-x-px active:translate-y-px';
const btnGhost = 'inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-cream/30 bg-dusk/30 px-7 text-[1.05rem] font-semibold text-fg transition-colors duration-150 hover:border-accent';

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
      <div className="overflow-hidden rounded-2xl p-3 text-left" style={{ backgroundImage: 'linear-gradient(180deg, rgb(27 20 16 / .2), rgb(27 20 16 / .6)), url("/tex/walnut-top.jpg")', backgroundSize: 'cover' }}>
        <div className="linen -rotate-1 rounded-md px-3 py-2">
          <p className="font-mono text-[0.58rem] font-semibold tracking-[0.16em] text-ink-muted uppercase">Your phone is your mic</p>
          <p className="font-display text-[1.9rem] leading-none text-ink italic">Joyce</p>
        </div>
        <div className="brass mx-auto mt-4 size-24 rounded-full p-2"><div className="size-full rounded-full" style={{ background: 'radial-gradient(circle at 36% 30%, #b9cdb5, #5D8A5E 58%, #34503a)', boxShadow: 'inset 2px 4px 8px rgb(27 20 16 / .45)' }} /></div>
        <p className="mt-2 text-center font-display-italic text-[2rem] leading-none text-cream">Good</p>
        <p className="paper mt-3 rounded-sm px-2 py-1.5 text-center font-display text-[0.9rem] text-ink italic">One at a time · face Bera · screen up</p>
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 font-mono text-[0.62rem] tracking-wide text-muted">
        <span className="size-2 rounded-full bg-lamp-good" />one voice
        <span className="size-2 rounded-full bg-lamp-amber" />two at once
        <span className="size-2 rounded-full bg-lamp-red" />too fast
      </div>
    </Frame>
  );
}

function AskedMock() {
  return (
    <Frame label="The Asked you dish: an amber nudge, 'Mom asked you: are you coming Sunday?', with Yes, Clarify and Can't.">
      <div className="dish rounded-2xl p-3">
        <div className="card-label text-warn!">Asked you</div>
        <div className="mt-2 rounded-xl bg-lamplight px-3 py-2.5 text-ink shadow-[0_0_0_2px_var(--lamplight)]">
          <p className="text-[0.95rem] leading-snug font-semibold">Mom asked <span className="underline decoration-[#3f5f86] decoration-2 underline-offset-4">you</span>:</p>
          <q className="mt-0.5 block font-display text-[1.3rem] leading-tight italic">Are you coming Sunday?</q>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            {['Yes', 'Clarify', "Can't"].map((l) => <span key={l} className="rounded-lg border border-ink/20 bg-cream/70 py-1.5 text-center text-[0.8rem] font-semibold">{l}</span>)}
          </div>
        </div>
      </div>
      <div className="dish mt-2 rounded-2xl p-3">
        <div className="card-label">Plans</div>
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
        <div className="flex items-center gap-2 card-label"><IconLaugh size={16} strokeWidth={2} />Why they laughed</div>
        <p className="mt-3 text-[0.78rem] text-muted">The table laughed at <strong className="text-ink">Mom</strong>, 3s ago:</p>
        <q className="mt-1 block font-display text-[1.45rem] leading-[1.12] italic">Don’t remind me, the smoke alarm went off for twenty minutes.</q>
        <p className="mt-3 border-t border-line/70 pt-2 text-[0.78rem] text-muted">Dad: We still call it the fire drill Thanksgiving.</p>
      </div>
    </Frame>
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
    <div className="min-h-dvh overflow-x-clip text-fg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-accent-fg">Skip to content</a>

      {/* nav */}
      <header className="absolute inset-x-0 top-0 z-20">
        <nav aria-label="Main" className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Wordmark height={wide ? 36 : 30} />
          <div className="flex items-center gap-1 sm:gap-2">
            <a href="/join.html" className="hidden h-11 items-center rounded-xl px-3 text-[0.95rem] font-semibold text-muted transition-colors hover:text-fg sm:inline-flex">Join a table</a>
            <a href="/" className="inline-flex h-11 items-center gap-2 rounded-xl border border-cream/30 bg-dusk/40 px-4 text-[0.95rem] font-semibold text-cream transition-colors hover:border-accent">Open the table</a>
          </div>
        </nav>
      </header>

      <main id="main">
        {/* HERO: the phone lying on the walnut (design/assets/mood/phone-on-table.png), our placemat on its screen */}
        <section aria-labelledby="hero-h" className="relative overflow-hidden pt-20 pb-14 sm:pb-20">
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
            <figure className="relative mx-auto w-full max-w-[30rem] lg:order-2">
              <div className="lay relative">
                <img src="/mood/phone-on-table.jpg" width={900} height={1205} alt="A phone lying screen-up on a walnut table between a stoneware mug and a brass table bell. On its screen, a linen placemat with one sentence in large italic type."
                  className="block h-auto w-full max-w-full rounded-[4px_6px_5px_3px]" fetchPriority="high" />
                {/* the phone's screen shows the product: the placemat and one sentence */}
                <div aria-hidden className="linen absolute top-[29.2%] left-[36.6%] flex h-[43.8%] w-[27.4%] flex-col justify-center overflow-hidden rounded-[7%/4%] px-[2.2%] shadow-none">
                  <span className="paper w-fit -rotate-2 rounded-[2px] px-1.5 font-display text-[clamp(0.55rem,2.6vw,0.85rem)] font-semibold italic">Mom said</span>
                  <p className="mt-2 font-display text-[clamp(0.8rem,4vw,1.35rem)] leading-[1.1] text-ink italic">Sunday at one, everyone brings a side.</p>
                </div>
              </div>
            </figure>
            <div className="lg:order-1">
              <Label>For hard-of-hearing adults at the family table</Label>
              <h1 id="hero-h" className="mt-5 font-display text-[2.5rem] leading-[1.04] tracking-[-0.01em] [text-shadow:2px_3px_8px_rgb(27_20_16/.55)] sm:text-[3.6rem] lg:text-[4.1rem]">
                <span className="text-cream/80">Every accessibility tool puts the burden on the deaf person.</span>{' '}
                <em className="text-cream">We built the other side.</em>
              </h1>
              <p className="mt-6 max-w-xl text-[1.15rem] leading-relaxed text-cream/85 sm:text-[1.3rem]">
                Transcription tells you what was said. <span className="font-semibold text-cream">We tell you what you missed.</span> Sunday lunch, Thursday standup: any table.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a href="/?replay=demo2" className={btnPrimary}><IconLamp size={22} strokeWidth={2} />Watch Sunday lunch</a>
                <a href="/" className={btnGhost}><ObjIcon name="table" fallback={IconTable} size={36} className="-my-2 -ml-2" />Start a table</a>
              </div>
              <p className="mt-5 font-mono text-[0.72rem] tracking-wider text-cream/75 uppercase">No wearables · phones on the table · nothing stored</p>
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
              A table is a contract between everyone at it. <em className="text-accent">The lamp keeps it, so she never has to.</em>
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
              Three moments at <em className="text-accent">Sunday lunch.</em>
            </h2>
          </Reveal>
          <ol className="mt-14 grid gap-6 lg:grid-cols-3">
            {[
              { n: '01', title: 'Phones on the table, screen up.', body: 'Each phone is its owner’s mic and a lamp. Green: one voice. Amber: two at once. Red: too fast. The hearing people see it, not you.', mock: <LampMock />, obj: <ObjIcon name="lamp" fallback={IconLamp} size={96} /> },
              { n: '02', title: 'Mom asked you.', body: 'A question aimed at you rings amber: the only interruption the app ever makes. The plans, with the why, wait on their dish.', mock: <AskedMock />, obj: <ObjIcon name="bell" fallback={IconForYou} size={96} /> },
              { n: '03', title: 'Why they laughed.', body: 'When the table laughs, the line that got the laugh lands on your screen. You get the joke three seconds late, instead of never.', mock: <LaughMock />, obj: <ObjIcon name="popper" fallback={IconLaugh} size={96} /> },
            ].map((m, k) => (
              <Reveal as="li" key={m.n} delay={k * 120} className="lay flex flex-col">
                <div className="paper deckle flex h-full flex-col p-5 sm:p-6" style={{ rotate: `${[-0.6, 0.5, -0.3][k]}deg` }}>
                  <div className="flex items-center gap-3">{m.obj}<p className="font-mono text-[0.72rem] font-semibold tracking-[0.18em] text-accent">{m.n}</p></div>
                  <h3 className="mt-1 font-display text-[1.7rem] leading-tight italic">{m.title}</h3>
                  <p className="mt-2 text-[1.02rem] leading-relaxed text-muted">{m.body}</p>
                  <div className="mt-5 flex flex-1 items-center rounded-md bg-dusk/85 py-5">{m.mock}</div>
                </div>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* CINEMATIC QUOTE */}
        <section aria-label="What it feels like" className="relative overflow-hidden bg-dusk/70 py-28 sm:py-40">
          <span aria-hidden className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 font-display text-[16rem] leading-none text-accent/15 select-none sm:text-[22rem]">“</span>
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
            <Reveal delay={150} className="surface-1 hidden items-center gap-4 rounded-2xl px-5 py-4 lg:flex">
              <TableRing seats={SAMPLE_SEATS} source="phones" size={104} />
              <p className="max-w-[14rem] text-[0.95rem] leading-snug text-muted">The table ring: who joined, where you sit, who has the mug right now.</p>
            </Reveal>
          </div>
          <ol className="relative mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            <span aria-hidden className="absolute top-11 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-transparent via-line-strong to-transparent lg:block" />
            {STEPS.map((s, k) => (
              <Reveal as="li" key={s.title} delay={k * 110} className="surface-1 relative rounded-2xl p-5 lg:mx-2 lg:border-0 lg:bg-transparent lg:p-3 lg:text-center lg:shadow-none">
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
            <span className="inline-flex items-center gap-1.5"><IconMug size={16} className="text-accent" />has the floor</span>
            <span className="inline-flex items-center gap-1.5"><IconSpeakForMe size={16} className="text-you" />speak for me</span>
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
      <footer className="bg-dusk/75">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1fr_2fr]">
          <div>
            <Wordmark height={34} />
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
