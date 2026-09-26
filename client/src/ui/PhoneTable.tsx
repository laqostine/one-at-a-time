// The host's phone: one person's seat at the table (design/BRAND.md). Three things only: what is
// being said now (the linen placemat, the one large element), what was asked of you and what was
// agreed (ONE paper card below it, with a word tab strip: Asked you · Plans · Laughs; swipe or tap
// to flip), and two objects on a quiet shelf: the mug (Speak for me) and the plate (Catch me up).
// Everything else is small and quiet. Nothing on this screen scrolls.
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Pause, Play, Settings } from 'lucide-react';
import type { Utterance } from '../../../shared/types';
import { usePresenceModel, Wordmark, type HeaderProps } from './Header';
import { PRESENCE_WORD } from './presenceStates';
import type { TableLampState } from './tableLamp';
import { ObjIcon, type ObjName } from './ObjIcon';
import { IconCatchUp, IconRepeat, IconSpeakForMe, type IconType } from './icons';
import { UttText } from './UttText';
import { hasDoubt } from '../state/confidence';
import { cn } from '@/lib/utils';

/* ---------- the lamp's light + the thin top row ---------- */
const POOL: Record<TableLampState['tone'], string> = {
  quiet: 'rgb(241 199 106 / .16)',
  good: 'rgb(241 199 106 / .2)',
  amber: 'rgb(217 154 61 / .34)',
  red: 'rgb(184 80 58 / .42)',
};

/** Only the lamp's pool of light on the table: it warms (amber/red) with the table's pace. No shade, no word. */
function LampPool({ lamp }: { lamp: TableLampState }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[60%] transition-[background] duration-700"
      style={{ background: `radial-gradient(60% 50% at 50% 0%, ${POOL[lamp.tone]}, transparent 75%)` }} />
  );
}

const iconBtn = 'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-cream/80 transition-colors duration-150 hover:bg-cream/10 hover:text-cream';

function TopRow(props: HeaderProps & { tableLamp: TableLampState }) {
  const { listening, onToggleListening, onSettings, onEveryoneJoins, participantCount = 0, badge, tableLamp: lamp } = props;
  return (
    <header className="relative flex h-12 shrink-0 items-center justify-between gap-2 pr-2 pl-4" aria-label="I Missed That">
      <span className="sr-only" role="status">{`Table lamp: ${lamp.word}. ${lamp.hint}.`}</span>
      <Wordmark height={24} className="relative opacity-90" />
      <div className="relative flex items-center">
        {badge}
        {onEveryoneJoins && (
          <button type="button" onClick={onEveryoneJoins} aria-label={`Table: ${participantCount} ${participantCount === 1 ? 'phone' : 'phones'} joined`}
            className="flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[0.9rem] font-semibold text-cream/85 transition-colors duration-150 hover:bg-cream/10 hover:text-cream">
            Table<span className="font-mono text-[0.8rem] tabular-nums text-cream/70">{participantCount}</span>
          </button>
        )}
        <button type="button" onClick={onToggleListening} aria-label={listening ? 'Pause listening' : 'Resume listening'} className={iconBtn}>
          {listening ? <Pause size={19} aria-hidden /> : <Play size={19} aria-hidden />}
        </button>
        <button type="button" onClick={onSettings} aria-label="Settings" className={iconBtn}><Settings size={19} aria-hidden /></button>
      </div>
    </header>
  );
}

/* ---------- the placemat ---------- */
/** The clerk's state, printed small in the placemat's corner: a brass dot and one word. */
function ClerkMark(props: HeaderProps) {
  const p = usePresenceModel(props);
  const word = p.flaring ? 'asked you' : !props.listening ? 'paused' : PRESENCE_WORD[p.state].toLowerCase();
  const busy = p.state === 'transcribing' || p.state === 'thinking' || p.state === 'speaking';
  return (
    <span role="status" aria-label={`The clerk: ${word}`}
      className={cn('absolute top-3.5 right-5 z-[2] flex items-center gap-1.5 font-mono text-[0.72rem] leading-none font-bold tracking-[0.06em]',
        p.flaring ? 'text-warn' : 'text-ink-muted')}>
      <span aria-hidden className={cn('size-2 rounded-full', p.flaring ? 'bg-lamplight ring-1 ring-warn/50' : props.listening ? 'brass' : 'bg-ink-muted/40', busy && 'imt-pulse')} />
      {word}
    </span>
  );
}

export function PhonePlacemat({ utt, name, color, onSpeaker, onAskRepeat, empty, presence, note }: {
  utt?: Utterance; name: string; color: string; onSpeaker: () => void; onAskRepeat?: (u: Utterance) => void;
  empty?: ReactNode; presence: HeaderProps; note: ReactNode;
}) {
  const doubt = !!utt && utt.final && hasDoubt(utt);
  return (
    <section aria-label="What is being said now" role="region"
      className="linen relative mx-4 mt-2 flex min-h-[11rem] flex-[1_1_48%] -rotate-[0.4deg] flex-col rounded-[6px_8px_7px_5px] px-5 pt-2.5 pb-4">
      {/* the hem: a stitched line near the edge */}
      <span aria-hidden className="pointer-events-none absolute inset-2 rounded-[6px] border border-dashed border-ink/12" />
      <ClerkMark {...presence} />
      <div className="relative flex min-h-11 shrink-0 items-center pr-28">
        {utt && (
          <button type="button" onClick={utt.speaker >= 0 ? onSpeaker : undefined} disabled={utt.speaker < 0}
            aria-label={utt.speaker >= 0 ? `${name} ${utt.final ? 'said' : 'is saying'}. Rename speaker.` : name}
            className="-ml-1.5 flex h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-1.5 disabled:cursor-default">
            <span aria-hidden className="size-3 shrink-0 rounded-full ring-2 ring-ink/15" style={{ background: color }} />
            <span className="truncate font-display text-[1.25rem] font-semibold text-ink italic">{name}</span>
          </button>
        )}
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden pt-1" aria-live="off">
        {utt ? (
          <p key={utt.id} className={cn('imt-line-in line-clamp-6 font-display text-[clamp(1.8rem,8.6vw,2.4rem)] leading-[1.14] font-[560] italic transition-colors duration-300 [@media(max-height:700px)]:line-clamp-4', utt.final ? 'text-ink' : 'text-ink/85')}>
            <UttText utt={utt} speaker={name} onAskRepeat={onAskRepeat} />
          </p>
        ) : (empty ?? <p className="pt-1 font-display text-[1.45rem] leading-snug text-ink-muted italic">Nobody is talking yet.</p>)}
      </div>
      {doubt && onAskRepeat && !utt.repeatRequested && (
        <button type="button" onClick={() => onAskRepeat(utt)} aria-label={`Didn't catch part of that. Ask ${name} to repeat at the next pause.`}
          className="relative mt-1 flex h-11 w-fit shrink-0 cursor-pointer items-center gap-1.5 self-end rounded-full border border-accent/40 px-3.5 text-[0.95rem] font-semibold text-accent">
          <IconRepeat size={16} strokeWidth={2} /> Repeat?
        </button>
      )}
      {note}
    </section>
  );
}

/* ---------- one paper card, three words on its tab strip ---------- */
export type DeckKey = 'asked' | 'plans' | 'laugh';
const DECK: { key: DeckKey; label: string }[] = [
  { key: 'asked', label: 'Asked you' },
  { key: 'plans', label: 'Plans' },
  { key: 'laugh', label: 'Laughs' },
];

export function CardDeck({ cards, ringing, nudgeId }: { cards: Record<DeckKey, ReactNode>; ringing: boolean; nudgeId?: string | number }) {
  const [pick, setPick] = useState<DeckKey>(ringing ? 'asked' : 'plans');
  const [dir, setDir] = useState<'l' | 'r'>('r');
  // A live question for you always turns the card to "Asked you".
  useEffect(() => { if (nudgeId) { setDir('l'); setPick('asked'); } }, [nudgeId]);
  const idx = DECK.findIndex((d) => d.key === pick);
  const go = (k: DeckKey) => { const j = DECK.findIndex((d) => d.key === k); if (j === idx) return; setDir(j > idx ? 'r' : 'l'); setPick(k); };
  const step = (d: 1 | -1) => go(DECK[(idx + d + DECK.length) % DECK.length].key);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  // Drag: the content follows the finger horizontally (rAF-batched), then glides away or back.
  const drag = useRef<{ x0: number; y0: number; id: number; horiz: boolean | null } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const setX = (dx: number | null) => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = card.current; if (!el) return;
      if (dx == null) { el.dataset.drag = '0'; el.style.transform = ''; el.style.opacity = ''; return; }
      el.dataset.drag = '1';
      el.style.transform = `translateX(${dx}px)`;
      el.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 320));
    });
  };
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { x0: e.clientX, y0: e.clientY, id: e.pointerId, horiz: null };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (d.horiz == null && Math.hypot(dx, dy) > 8) {
      d.horiz = Math.abs(dx) > Math.abs(dy);
      if (d.horiz) { try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ } }
    }
    if (d.horiz) { setX(dx); if (card.current) card.current.dataset.justDragged = '1'; }
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null;
    window.setTimeout(() => { if (card.current) card.current.dataset.justDragged = '0'; }, 0);
    if (!d || !d.horiz) return;
    const dx = e.clientX - d.x0;
    setX(null);
    if (Math.abs(dx) > 56) step(dx < 0 ? 1 : -1);
  };
  // A drag must not also count as a tap on a row inside the card.
  const onClickCapture = (e: React.MouseEvent) => { if (card.current?.dataset.justDragged === '1') { e.stopPropagation(); e.preventDefault(); } };

  return (
    <div className={cn('relative mx-4 mt-4 mb-3 flex min-h-[9.5rem] flex-col transition-[flex-basis] duration-200', ringing ? 'flex-[1_1_50%]' : 'flex-[1_1_36%]')}>
      {/* a soft darker shadow under the card, so the paper edge reads cleanly against the wood */}
      <span aria-hidden className="pointer-events-none absolute -inset-1.5 rounded-[16px] bg-[rgb(18_11_6/.42)] blur-[10px]" />
      <div className="paper relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[6px_9px_7px_8px] rotate-[0.3deg]">
        <div role="tablist" aria-label="Your card" className="flex h-12 shrink-0 items-end gap-1 border-b border-line px-3"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            const j = (idx + (e.key === 'ArrowRight' ? 1 : -1) + DECK.length) % DECK.length;
            go(DECK[j].key); tabs.current[j]?.focus();
          }}>
          {DECK.map((d, j) => {
            const on = d.key === pick;
            const loud = d.key === 'asked' && ringing;
            return (
              <span key={d.key} className="flex items-end">
                {j > 0 && <span aria-hidden className="pb-3 text-ink-muted/60 select-none">·</span>}
                <button ref={(el) => { tabs.current[j] = el; }} type="button" role="tab" id={`deck-tab-${d.key}`} aria-selected={on} aria-controls="deck-panel"
                  tabIndex={on ? 0 : -1} onClick={() => go(d.key)} aria-label={d.label + (loud ? ' (someone asked you)' : '')}
                  className={cn('relative flex h-11 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[0.95rem] font-semibold whitespace-nowrap transition-colors duration-150',
                    on ? 'text-ink' : 'text-ink-muted hover:text-ink', loud && 'text-warn')}>
                  {loud && <span aria-hidden className="size-2 rounded-full bg-lamplight ring-1 ring-warn/60" />}
                  {d.label}
                  <span aria-hidden className={cn('absolute inset-x-2.5 bottom-1.5 h-[2.5px] rounded-full bg-current transition-[opacity,transform] duration-200', on ? 'opacity-100' : 'scale-x-0 opacity-0')} />
                </button>
              </span>
            );
          })}
        </div>
        <div id="deck-panel" role="tabpanel" aria-labelledby={`deck-tab-${pick}`}
          className="relative min-h-0 flex-1 touch-pan-y px-3 pt-2 pb-2 select-none"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; setX(null); }}
          onClickCapture={onClickCapture}>
          <div key={pick} className={cn('flex h-full min-h-0 flex-col', dir === 'r' ? 'imt-slide-r' : 'imt-slide-l')}>
            <div ref={card} className="deck-card flex h-full min-h-0 flex-col">{cards[pick]}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- objects on the shelf you can press ---------- */
export function TableObject({ obj, Icon, label, busyLabel, busy, onClick, invite, btnRef }: {
  obj: ObjName; Icon: IconType; label: string; busyLabel?: string; busy?: boolean; onClick: () => void; invite?: boolean; btnRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button ref={btnRef} type="button" onClick={onClick} disabled={busy} aria-busy={busy} aria-label={label}
      className={cn('press group flex min-h-[4.9rem] flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1 hover:bg-cream/[.05] disabled:cursor-default [@media(max-height:700px)]:min-h-[4.3rem]',
        invite && 'imt-invite')}>
      <span className="transition-transform duration-200 group-hover:-translate-y-0.5"><ObjIcon name={obj} fallback={Icon} size={50} className="[@media(max-height:700px)]:-my-1" /></span>
      <span className="text-[0.945rem] font-semibold whitespace-nowrap text-cream [text-shadow:1px_2px_3px_rgb(27_20_16/.8)]">{busy && busyLabel ? busyLabel : label}</span>
    </button>
  );
}

export const SpeakObject = ({ onClick, btnRef }: { onClick: () => void; btnRef: Ref<HTMLButtonElement> }) =>
  <TableObject obj="mug" Icon={IconSpeakForMe} label="Speak for me" onClick={onClick} btnRef={btnRef} />;
export const CatchUpObject = ({ onClick, busy, invite }: { onClick: () => void; busy: boolean; invite: boolean }) =>
  <TableObject obj="placemat" Icon={IconCatchUp} label="Catch me up" busyLabel="Catching up…" busy={busy} invite={invite} onClick={onClick} />;

/* ---------- the whole seat ---------- */
export function PhoneTable({ header, lamp, placemat, deck, objects }: {
  header: HeaderProps; lamp: TableLampState; placemat: ReactNode; deck: ReactNode; objects: ReactNode;
}) {
  return (
    <div className="seat relative mx-auto flex h-dvh max-w-xl flex-col overflow-hidden pt-[env(safe-area-inset-top)]">
      {/* calm the walnut further on the phone: a warm dark wash, so paper edges read cleanly */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(22_14_8/.34),rgb(22_14_8/.46))]" />
      <LampPool lamp={lamp} />
      <TopRow {...header} tableLamp={lamp} />
      {placemat}
      {deck}
      {/* the shelf: a faint darker band, so the two objects read as one row of actions */}
      <nav aria-label="Actions" className="relative flex shrink-0 items-stretch gap-3 border-t border-cream/[.07] bg-[rgb(16_10_6/.4)] px-5 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {objects}
      </nav>
    </div>
  );
}
