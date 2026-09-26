import { Coffee, Utensils, MessageCircle, Sparkles } from 'lucide-react'

const seats = [
  { name: 'Mum', color: '#d17b5f', position: 'seat-mum' },
  { name: 'Dad', color: '#c9a45b', position: 'seat-dad' },
  { name: 'Emir', color: '#6fa8a1', position: 'seat-emir' },
  { name: 'Aunt Nesrin', color: '#9b7bb5', position: 'seat-nesrin', active: true },
  { name: 'Deniz', color: '#7393b3', position: 'seat-deniz' },
]

function Seat({ name, color, position, active }: (typeof seats)[number]) {
  return (
    <div
      className={`seat ${position} ${active ? 'seat-active' : ''}`}
      style={{ '--seat-color': color } as React.CSSProperties}
      aria-label={`${name}${active ? ', speaking' : ''}`}
    >
      <span className="seat-dot" />
      <span>{name}</span>
      {active && <span className="floor-badge"><Coffee size={15} strokeWidth={2.5} /> has the floor</span>}
    </div>
  )
}

function Dish({ icon: Icon, title, children, className = '' }: { icon: typeof Utensils; title: string; children: React.ReactNode; className?: string }) {
  return (
    <article className={`dish ${className}`}>
      <div className="dish-heading"><span className="dish-icon"><Icon size={17} /></span><h2>{title}</h2></div>
      {children}
    </article>
  )
}

export default function Home() {
  return (
    <main className="dinner-room">
      <header className="room-header">
        <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <div>
          <p className="eyebrow">the family dinner table</p>
          <p className="subhead">A little help keeping up with the conversation</p>
        </div>
        <div className="table-status" aria-label="Table status: one at a time"><span className="status-light" /> <strong>one at a time</strong><span className="status-note">· easy to follow</span></div>
      </header>

      <section className="table-wrap" aria-label="Conversation table">
        <div className="table-shadow" />
        <div className="wood-table">
          <div className="table-ring" />
          {seats.map((seat) => <Seat key={seat.name} {...seat} />)}
          <div className="placemat">
            <div className="placemat-rule" />
            <p className="speaker-label"><span className="speaker-dot" /> Aunt Nesrin is speaking</p>
            <p className="sentence">Nesrin is staying till Sunday, so the spare room needs sheets.</p>
            <p className="heard-time">just now</p>
          </div>
          <div className="table-sparkle sparkle-one" /><div className="table-sparkle sparkle-two" />
        </div>

        <div className="dishes" aria-label="Conversation notes">
          <Dish icon={Utensils} title="Plans" className="plans-dish">
            <p className="dish-main">Spare room for Nesrin</p>
            <p className="dish-detail"><span>because</span> she is staying till Sunday</p>
          </Dish>
          <Dish icon={MessageCircle} title="Asked you" className="asked-dish">
            <p className="dish-main">Dad asked you:</p>
            <p className="asked-question">Can you pick up bread?</p>
          </Dish>
          <Dish icon={Sparkles} title="Why they laughed" className="laugh-dish">
            <p className="dish-main">Mum said the roast was “well done.”</p>
            <p className="dish-detail">She meant it two ways.</p>
          </Dish>
        </div>
      </section>

      <footer className="room-footer"><span className="footer-line" /> <span>Conversation is captured as it happens</span> <span className="footer-line" /></footer>
    </main>
  )
}
