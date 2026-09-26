import { ArrowUpRight, Play, Plus } from 'lucide-react'

const placeCards = [
  { name: 'Deniz', position: 'left-[10%] top-[29%]', tone: 'amber' },
  { name: 'Mum', position: 'left-[28%] top-[60%]', tone: 'cream' },
  { name: 'Omar', position: 'right-[30%] top-[62%]', tone: 'rust' },
  { name: 'Lena', position: 'right-[10%] top-[31%]', tone: 'sage' },
]

const stats = [
  ['About 50 million', 'people in the EU say they have trouble hearing.'],
  ['The place they most want to hear', "isn't the office. It's the family table.", '56%, Italy'],
  ['More than 90%', 'of deaf children have hearing parents.'],
]

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#17120f] text-[#f7eddb]">
      <section className="relative min-h-[780px] px-6 pb-24 pt-6 sm:px-10 lg:px-16">
        <nav className="relative z-20 mx-auto flex max-w-[1320px] items-center justify-between border-b border-[#f5dfbd]/20 pb-5">
          <a href="#top" className="font-serif text-[22px] tracking-[-0.04em]">I Missed That<span className="text-[#e6a45e]">.</span></a>
          <div className="hidden items-center gap-8 text-[11px] uppercase tracking-[0.18em] text-[#cbbba5] sm:flex">
            <a href="#why" className="transition-colors hover:text-[#f7eddb]">Why this matters</a>
            <a href="#rules" className="transition-colors hover:text-[#f7eddb]">House rules</a>
            <a href="#start" className="rounded-full border border-[#f5dfbd]/40 px-4 py-2 text-[#f7eddb] transition-colors hover:bg-[#f7eddb] hover:text-[#17120f]">Get started</a>
          </div>
          <button aria-label="Open menu" className="sm:hidden"><span className="block h-px w-6 bg-[#f7eddb]" /><span className="mt-1.5 block h-px w-4 bg-[#f7eddb]" /></button>
        </nav>

        <div className="relative z-10 mx-auto grid max-w-[1320px] grid-cols-1 pt-16 lg:grid-cols-[44%_56%] lg:pt-24">
          <div className="relative z-10 max-w-[580px]">
            <p className="mb-7 flex items-center gap-3 text-[10px] uppercase tracking-[0.26em] text-[#e6a45e]"><span className="h-px w-9 bg-[#e6a45e]" />A better seat at the table</p>
            <h1 className="max-w-[570px] font-serif text-[clamp(3.3rem,6.1vw,6.4rem)] leading-[0.91] tracking-[-0.065em] text-[#fff6e7]">You were at the table.<br /><em className="text-[#e6a45e]">You missed the joke.</em></h1>
            <p className="mt-9 max-w-[390px] font-serif text-[clamp(1.15rem,1.7vw,1.45rem)] leading-[1.25] text-[#cdbca5]">Your family&apos;s phones become the table&apos;s ears.</p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <a href="#start" className="group flex items-center gap-4 rounded-full bg-[#e6a45e] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#241810] transition-transform hover:-translate-y-0.5">Watch Sunday lunch <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f7eddb]/25"><Play className="h-3 w-3 fill-current" /></span></a>
              <a href="#start" className="flex items-center gap-2 rounded-full border border-[#f5dfbd]/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#f7eddb] transition-colors hover:bg-[#f7eddb] hover:text-[#241810]">Start a table <ArrowUpRight className="h-3.5 w-3.5" /></a>
            </div>
          </div>

          <div className="relative mt-16 min-h-[430px] lg:mt-[-20px]">
            <div className="lamp-wire absolute left-1/2 top-[-105px] h-[125px] w-px bg-[#5d4a39]" />
            <div className="lamp absolute left-1/2 top-[12px] z-20 h-10 w-24 -translate-x-1/2 rounded-b-[50%] bg-[#2a211b] shadow-[0_8px_15px_#f6b86666]" />
            <div className="light-cone absolute left-1/2 top-[50px] h-[390px] w-[620px] -translate-x-1/2" />
            <div className="dust absolute inset-0" />
            <div className="table-shadow absolute bottom-[20px] left-1/2 h-[210px] w-[90%] -translate-x-1/2 rounded-[50%] bg-[#080706]/80 blur-2xl" />
            <div className="table-top absolute bottom-[55px] left-1/2 h-[250px] w-[92%] -translate-x-1/2 rotate-[-5deg] rounded-[50%] border-[12px] border-[#5a2f1e] bg-[#8b4d2a] shadow-[inset_0_12px_30px_#c27a4788,0_30px_25px_#080706aa]" />
            <div className="table-grain absolute bottom-[100px] left-1/2 h-[150px] w-[76%] -translate-x-1/2 rotate-[-5deg] rounded-[50%] opacity-50" />
            {placeCards.map((card) => <div key={card.name} className={`phone-card ${card.tone} absolute z-10 ${card.position}`}><span className="phone-dot" /><span>{card.name}</span><small>tap to listen</small></div>)}
            <div className="absolute bottom-[138px] left-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -rotate-6 items-center justify-center rounded-full border border-[#edbf7e]/50 bg-[#d9944d] shadow-[0_5px_20px_#170e09aa]"><Plus className="h-5 w-5 text-[#472717]" /></div>
            <p className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] uppercase tracking-[0.22em] text-[#a9937e]">A table that keeps everyone in</p>
          </div>
        </div>
      </section>

      <section id="why" className="border-y border-[#3c2d23] bg-[#e9d7b9] px-6 py-14 text-[#302119] sm:px-10 lg:px-16">
        <div className="mx-auto grid max-w-[1320px] gap-10 md:grid-cols-3 md:gap-0">{stats.map(([strong, rest, note], i) => <div key={strong} className={`max-w-[340px] ${i > 0 ? 'md:border-l md:border-[#aa8d6d] md:pl-10' : ''} ${i < 2 ? 'md:pr-10' : ''}`}><p className="font-serif text-[22px] leading-[1.08] tracking-[-0.04em]"><strong className="font-normal text-[#9b4f2d]">{strong}</strong> {rest}</p>{note && <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-[#8d7258]">{note}</p>}</div>)}</div>
      </section>

      <section id="rules" className="bg-[#f0dfc2] px-6 py-20 text-[#302119] sm:px-10 lg:px-16"><div className="mx-auto flex max-w-[920px] flex-col items-start justify-between gap-10 md:flex-row md:items-center"><div><p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[#9b4f2d]">Small changes, big difference</p><h2 className="font-serif text-5xl tracking-[-0.06em] sm:text-6xl">House rules</h2></div><div className="rule-card relative max-w-[520px] rotate-[-1.5deg] bg-[#fff6dd] px-8 py-7 shadow-[5px_7px_0_#c5a985] sm:px-12"><span className="absolute -top-3 left-1/2 h-7 w-14 -translate-x-1/2 rounded-sm bg-[#dcae72]/70" /><p className="font-serif text-xl leading-[1.4] text-[#64442d] sm:text-2xl">One at a time <span className="text-[#b87746]">·</span> Face Deniz <span className="text-[#b87746]">·</span> Phones on the table, screen up</p><p className="mt-5 text-[10px] uppercase tracking-[0.2em] text-[#a98a6b]">— from the fridge, Sunday 2024</p></div></div></section>
      <footer id="start" className="flex flex-col items-center justify-between gap-5 bg-[#17120f] px-6 py-8 text-[10px] uppercase tracking-[0.18em] text-[#8f7b68] sm:flex-row sm:px-16"><span>© I Missed That</span><span>For every family at the table</span></footer>
    </main>
  )
}

export const dynamic = 'force-static'
