'use client'

import { useMemo, useState } from 'react'

const guests = [
  { name: 'Maya', role: 'your seat', initials: 'M', tone: 'coral', position: 'top-1/2 left-3 -translate-y-1/2 -translate-x-1/2' },
  { name: 'Dad', role: 'north seat', initials: 'D', tone: 'sage', position: 'top-3 left-1/2 -translate-x-1/2 -translate-y-1/2' },
  { name: 'Aunt Lina', role: 'east seat', initials: 'L', tone: 'blue', position: 'top-1/2 right-3 -translate-y-1/2 translate-x-1/2' },
  { name: 'Sam', role: 'south seat', initials: 'S', tone: 'gold', position: 'bottom-3 left-1/2 -translate-x-1/2 translate-y-1/2' },
]

export default function Page() {
  const [speaking, setSpeaking] = useState<string[]>(['Dad'])
  const [activeChip, setActiveChip] = useState('Plans')
  const overlapping = speaking.length > 1

  const status = useMemo(() => {
    if (overlapping) return 'Two people are talking'
    if (speaking.length === 1) return `${speaking[0]} is speaking`
    return 'Listening for voices'
  }, [overlapping, speaking])

  function toggleSpeaker(name: string) {
    setSpeaking((current) => current.includes(name) ? current.filter((person) => person !== name) : [...current, name])
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#171513] px-5 py-6 text-[#f4eee4] sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d6a45f]/60 text-sm text-[#eab86f]">◌</div>
            <div>
              <p className="font-serif text-lg tracking-tight">Gather</p>
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#8e877c]">Dinner table · 7:42 PM</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${overlapping ? 'border-[#d9a45c]/70 bg-[#5a3d22]/50 text-[#efbd72]' : 'border-white/10 bg-white/[0.03] text-[#a7a097]'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${overlapping ? 'bg-[#e8ae5d] shadow-[0_0_10px_#e8ae5d]' : 'bg-[#86aa89]'}`} />
            {overlapping ? 'Overlap alert' : 'Table is clear'}
          </div>
        </header>

        <section className="grid items-center gap-12 py-10 lg:grid-cols-[1fr_1.1fr] lg:py-16">
          <div className="max-w-md">
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.28em] text-[#c99554]">Live conversation</p>
            <h1 className="font-serif text-5xl leading-[0.98] tracking-[-0.04em] text-[#f7f0e5] sm:text-6xl">Stay at the<br /><em className="text-[#d8a864]">table.</em></h1>
            <p className="mt-6 max-w-sm text-[15px] leading-7 text-[#a49b90]">Every voice has a place. Tap a phone to tell Gather who you&apos;re listening to.</p>
            <div className="mt-9 flex flex-wrap gap-2" aria-label="Conversation shortcuts">
              {['Plans', 'Asked you', 'Why they laughed'].map((chip) => (
                <button key={chip} onClick={() => setActiveChip(chip)} className={`rounded-full border px-4 py-2 text-xs transition-all ${activeChip === chip ? 'border-[#d8a864] bg-[#d8a864] text-[#211b15]' : 'border-white/15 bg-white/[0.025] text-[#b9b0a5] hover:border-white/30'}`}>{chip}</button>
              ))}
            </div>
          </div>

          <div className="relative mx-auto flex aspect-square w-full max-w-[540px] items-center justify-center">
            <div className={`absolute inset-[10%] rounded-full blur-3xl transition-all duration-700 ${overlapping ? 'bg-[#c27a36]/25' : 'bg-[#c99554]/10'}`} />
            <div className="relative aspect-square w-[76%] rounded-full border-[14px] border-[#5b3924] bg-[radial-gradient(circle_at_35%_25%,#9a6945,#71472f_45%,#4c2e22_100%)] shadow-[0_30px_80px_rgba(0,0,0,.5),inset_0_0_0_2px_rgba(226,164,102,.18)]">
              <div className="absolute inset-5 rounded-full border border-[#d39a5b]/20" />
              <div className="absolute inset-[13%] rounded-full bg-[#241b16]/90 p-5 shadow-[0_10px_30px_rgba(0,0,0,.35)] sm:p-8">
                <div className="flex h-full flex-col items-center justify-center rounded-[45%] border border-[#b78350]/15 bg-[#2a201a] px-5 text-center shadow-inner sm:px-8">
                  <span className="mb-3 text-[9px] uppercase tracking-[0.3em] text-[#b98855]">{activeChip}</span>
                  <p className="font-serif text-xl leading-snug text-[#f1e5d5] sm:text-2xl">“We could take the coast road on Sunday.”</p>
                  <span className="mt-4 text-[10px] text-[#918477]">{status}</span>
                </div>
              </div>

              {guests.map((guest) => {
                const isSpeaking = speaking.includes(guest.name)
                return <button key={guest.name} onClick={() => toggleSpeaker(guest.name)} aria-pressed={isSpeaking} aria-label={`${isSpeaking ? 'Stop' : 'Start'} listening to ${guest.name}`} className={`group absolute ${guest.position} z-10 flex flex-col items-center gap-2 transition-transform hover:scale-105`}>
                  <span className={`relative flex h-16 w-11 items-center justify-center rounded-[11px] border-2 shadow-xl transition-all duration-300 ${isSpeaking ? 'border-[#f1bb6e] bg-[#32251b] shadow-[0_0_26px_rgba(236,170,83,.7)]' : 'border-[#866042] bg-[#2a211b]'}`}>
                    <span style={{ backgroundColor: guest.tone === 'coral' ? '#dd806c' : guest.tone === 'sage' ? '#9ab58d' : guest.tone === 'blue' ? '#87a9c0' : '#e4b362' }} className={`h-2.5 w-2.5 rounded-full ${isSpeaking ? 'animate-pulse shadow-[0_0_13px_currentColor]' : ''}`} />
                    <span className="absolute bottom-1 h-px w-5 bg-white/20" />
                  </span>
                  <span className="rounded-full bg-[#241b16]/90 px-2.5 py-1 text-[10px] text-[#c8bdb0] shadow-lg">{guest.name}</span>
                </button>
              })}
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-t border-white/10 pt-5 text-xs text-[#857c72] sm:flex-row sm:items-center sm:justify-between">
          <p><span className="mr-2 text-[#d6a45f]">✦</span>Tap a phone when someone starts speaking</p>
          <p className="uppercase tracking-[0.2em] text-[#665f58]">{speaking.length} of 4 listening</p>
        </footer>
      </div>
    </main>
  )
}
