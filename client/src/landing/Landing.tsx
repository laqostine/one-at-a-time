// One at a time: the landing page (design/DESIGN.md §3). Cream, type only, no image.
import { Fragment, useEffect } from 'react';

const NUMBERS = [
  '50M in the EU report trouble hearing',
  'Family table is the #1 place they want to hear, 56%',
  'Only 4% of non-speech info reaches captions',
];

export default function Landing() {
  useEffect(() => { document.title = 'One at a time'; }, []);
  return (
    <div className="mx-auto flex min-h-dvh max-w-[760px] flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-ink sm:px-8">
      <main className="my-auto py-10">
        <h1 className="oat-in font-display-italic text-[64px] leading-[0.98] tracking-[-0.02em]">One at a time.</h1>
        <p className="mt-6 max-w-[34ch] text-[22px] leading-[1.45]">
          Every accessibility tool puts the burden on the deaf person. We built the other side. Everyone’s phone goes on the table.
          When two people talk at once, their phones turn amber. The hard-of-hearing person reads one sentence at a time, and taps once to speak.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <a href="/" className="flex h-16 items-center justify-center rounded-full bg-amber px-8 text-[20px] font-bold text-ink">Open the listener</a>
          <a href="/join.html" className="flex h-16 items-center justify-center rounded-full border-2 border-ink px-8 text-[20px] font-bold text-ink">Put my phone on the table</a>
        </div>
        {/* One line of three numbers (stacked with hairlines on narrow phones). */}
        <p className="mt-12 flex flex-col border-t border-rule sm:flex-row sm:items-stretch sm:pt-5" aria-label="Why it matters">
          {NUMBERS.map((x, k) => (
            <Fragment key={x}>
              {k > 0 && <span aria-hidden className="h-px w-full bg-rule sm:mx-4 sm:h-auto sm:w-px" />}
              <span className="oat-label min-w-0 py-3 sm:flex-1 sm:py-0">{x}</span>
            </Fragment>
          ))}
        </p>
      </main>
      <footer className="oat-label border-t border-rule pt-4">Nothing is stored · English Italian Turkish</footer>
    </div>
  );
}
