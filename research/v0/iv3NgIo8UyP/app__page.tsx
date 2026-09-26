'use client'

import { useState } from 'react'

const states = [
  { name: 'One person speaking', color: 'green', className: 'bg-[#9dbd73]', glow: 'shadow-[0_0_70px_28px_rgba(157,189,115,0.34)]' },
  { name: 'Two people speaking', color: 'amber', className: 'bg-[#d9a958]', glow: 'shadow-[0_0_70px_28px_rgba(217,169,88,0.34)]' },
  { name: 'Too much overlap', color: 'red', className: 'bg-[#c87868]', glow: 'shadow-[0_0_70px_28px_rgba(200,120,104,0.34)]' },
]

export default function Home() {
  const [activeState, setActiveState] = useState(0)
  const state = states[activeState]

  return (
    <main className={`lamp-shell state-${state.color}`}>
      <div className="lamp-grain" aria-hidden="true" />
      <header className="relative z-10 flex items-start justify-between px-7 pt-9">
        <div>
          <p className="eyebrow">your phone is your mic</p>
          <h1 className="owner-name">Emir</h1>
        </div>
        <span className="table-mark" aria-label="Dinner table mode">table 04</span>
      </header>

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center pb-8" aria-label="Listening status">
        <div className={`lamp-orb ${state.glow}`} role="img" aria-label={state.name}>
          <span className="orb-inner" />
          <span className="orb-shine" />
        </div>
        <p className="status-label">{state.name}</p>
        <div className="state-picker" role="group" aria-label="Preview listening states">
          {states.map((item, index) => (
            <button
              key={item.color}
              type="button"
              aria-label={`Show ${item.name}`}
              aria-pressed={activeState === index}
              onClick={() => setActiveState(index)}
              className={`state-dot ${item.className} ${activeState === index ? 'is-active' : ''}`}
            />
          ))}
        </div>
      </section>

      <section className="relative z-10 px-5 pb-5" aria-labelledby="say-card-title">
        <div className="say-card">
          <div className="flex items-center justify-between">
            <p id="say-card-title" className="card-kicker">say card</p>
            <span className="card-rule" aria-hidden="true" />
          </div>
          <p className="card-message">One at a time helps. Face Deniz.</p>
          <p className="card-hint">A little room for every voice.</p>
        </div>
        <div className="linen-edge" aria-hidden="true">
          <span /> <span /> <span /> <span /> <span /> <span /> <span />
        </div>
      </section>
    </main>
  )
}
