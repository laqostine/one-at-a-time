// The host's phone, lying flat on the family table (design/BRAND.md, mood board phone-on-table.png).
// A place setting, top to bottom: the pendant lamp over the table (warm, amber/red with the table's
// pace), the linen placemat with the sentence being said, ONE object card at a time (Asked you >
// Plans > Why they laughed; swipe or tap the objects to flip), and two objects to press: the mug
// (Speak for me) and the placemat (Catch me up). Nothing on this screen scrolls.
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Pause, Play, Settings } from 'lucide-react';
import type { Utterance } from '../../../shared/types';
import { usePresenceModel, Wordmark, type HeaderProps } from './Header';
import { PresenceAuto } from './PresenceAuto';
import { PRESENCE_WORD } from './presenceStates';
import type { TableLampState } from './tableLamp';
import { ObjIcon, type ObjName } from './ObjIcon';
import { IconCatchUp, IconDecision, IconForYou, IconLaugh, IconRepeat, IconSpeakForMe, IconTable, type IconType } from './icons';
import { UttText } from './UttText';
import { hasDoubt } from '../state/confidence';
import { cn } from '@/lib/utils';

/* ---------- the pendant lamp + the thin top row ---------- */
const POOL: Record<TableLampState['tone'], string> = {
  quiet: 'rgb(241 199 106 / .22)',
  good: 'rgb(241 199 106 / .26)',
  amber: 'rgb(217 154 61 / .42)',
  red: 'rgb(184 80 58 / .5)',
};

function Pendant({ lamp }: { lamp: TableLampState }) {
  const loud = lamp.tone === 'amber' || lamp.tone === 'red';
  return (
    <>
      {/* the pool of light on the table, under the shade */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[70%] transition-[background] duration-700"
        style={{ background: `radial-gradient(60% 55% at 50% 0%, ${POOL[lamp.tone]}, transparent 75%)` }} />
      <div className="pointer-events-none absolute top-0 left-1/2 flex -translate-x-1/2 flex-col items-center" role="status"
        aria-label={`Table lamp: ${lamp.word}. ${lamp.hint}.`}>
        <span aria-hidden className="h-3 w-px bg-[#8a6a4a]" />
        <span aria-hidden className="brass h-[18px] w-[62px] rounded-t-[70%] rounded-b-[3px]" />
        <span aria-hidden className="-mt-px h-[5px] w-[22px] rounded-b-full transition-colors duration-500"
          style={{ background: loud ? lamp.hex : 'var(--lamplight)' }} />
        {loud && <span className="mt-1 rounded-full bg-dusk/80 px-2 py-0.5 font-mono text-[0.62rem] font-semibold tracking-[0.14em] text-cream uppercase">{lamp.word}</span>}
      </div>
    </>
  );
}

const iconBtn = 'flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full text-cream/85 transition-colors duration-150 hover:bg-cream/10 hover:text-cream';

function TopRow(props: HeaderProps & { tableLamp: TableLampState }) {
  const { listening, onToggleListening, onSettings, onEveryoneJoins, participantCount = 0, badge, tableLamp: lamp } = props;
  const p = usePresenceModel(props);
  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between gap-2 px-3" aria-label="I Missed That: status">
      <Pendant lamp={lamp} />
      <div className="relative flex min-w-0 flex-col">
        <Wordmark height={28} />
        <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[0.6rem] font-semibold tracking-[0.14em] text-cream/75 uppercase" role="status">
          <span aria-hidden className={cn('size-1.5 rounded-full', p.status.tone, p.live && 'imt-pulse')} />{p.status.text}
        </span>
      </div>
      <div className="relative flex items-center">
        {badge}
        {onEveryoneJoins && (
          <button type="button" onClick={onEveryoneJoins} aria-label={`Everyone joins (${participantCount} connected)`} className={cn(iconBtn, 'relative')}>
            <ObjIcon name="table" fallback={IconTable} size={30} />
            <span className={cn('absolute right-0.5 bottom-0.5 min-w-5 rounded-full px-1 text-center font-mono text-[0.62rem] leading-5 font-bold tabular-nums',
              participantCount > 0 ? 'bg-tea text-dusk' : 'bg-card-2 text-muted')}>{participantCount}</span>
          </button>
        )}
        <button type="button" onClick={onToggleListening} aria-label={listening ? 'Pause listening' : 'Resume listening'} className={iconBtn}>
          {listening ? <Pause size={20} aria-hidden /> : <Play size={20} aria-hidden />}
        </button>
        <button type="button" onClick={onSettings} aria-label="Settings" className={iconBtn}><Settings size={20} aria-hidden /></button>
      </div>
    </header>
  );
}

/* ---------- the placemat ---------- */
function PlaceCard(props: HeaderProps) {
  const p = usePresenceModel(props);
  const word = p.flaring ? 'Asked you' : PRESENCE_WORD[p.state];
  return (
    // A folded place card standing at the top edge of the mat: the clerk, and what it is doing.
    <div className="paper absolute -top-5 right-4 z-[3] flex rotate-[2deg] items-center gap-1.5 rounded-[4px] py-1 pr-2.5 pl-1" role="status" aria-label={`The clerk: ${word}`}>
      {/* the clerk sits on a dark stoneware coaster so its colors read on paper */}
      <span className="flex size-12 items-center justify-center rounded-full bg-[#2a1d14] shadow-[inset_1px_2px_4px_rgb(0_0_0/.5)]">
        <PresenceAuto size={48} state={p.state} level={p.level} flare={props.flare ?? 0} halo={false} />
      </span>
      <span className={cn('font-display text-[0.95rem] italic', p.flaring ? 'text-warn' : 'text-ink-muted')}>{word}</span>
    </div>
  );
}

export function PhonePlacemat({ utt, name, color, onSpeaker, onAskRepeat, empty, presence, note }: {
  utt?: Utterance; name: string; color: string; onSpeaker: () => void; onAskRepeat?: (u: Utterance) => void;
  empty: ReactNode; presence: HeaderProps; note: ReactNode;
}) {
  const doubt = !!utt && utt.final && hasDoubt(utt);
  return (
    <section aria-label="On the placemat: what is being said now" role="region"
      className="linen relative mx-3 mt-6 flex min-h-0 flex-[1_1_38%] -rotate-[0.6deg] flex-col rounded-[6px_8px_7px_5px] px-5 pt-6 pb-4">
      {/* the hem: a stitched line near the edge, like the mat in the photo */}
      <span aria-hidden className="pointer-events-none absolute inset-2 rounded-[6px] border border-dashed border-ink/12" />
      <PlaceCard {...presence} />
      <div className="relative flex min-h-11 shrink-0 items-center gap-2 pr-28">
        {utt ? (
          <button type="button" onClick={utt.speaker >= 0 ? onSpeaker : undefined} disabled={utt.speaker < 0}
            aria-label={utt.speaker >= 0 ? `${name} ${utt.final ? 'said' : 'is saying'}. Rename speaker.` : name}
            className="paper flex h-10 min-w-0 -rotate-2 cursor-pointer items-center gap-2 rounded-[3px] px-3 disabled:cursor-default">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
            <span className="truncate font-display text-[1.15rem] font-semibold italic">{name}</span>
            <span className="text-[0.85rem] text-ink-muted">{utt.final ? 'said' : 'is saying'}</span>
          </button>
        ) : <span className="font-mono text-[0.68rem] font-semibold tracking-[0.16em] text-ink-muted uppercase">The placemat</span>}
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden pt-2" aria-live="off">
        {utt ? (
          <p key={utt.id} className={cn('imt-in line-clamp-6 font-display text-[clamp(1.72rem,8.6vw,2.3rem)] leading-[1.14] italic', utt.final ? 'text-ink' : 'text-ink/75')}>
            <UttText utt={utt} speaker={name} onAskRepeat={onAskRepeat} />
          </p>
        ) : empty}
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

/* ---------- one object card at a time ---------- */
export type DeckKey = 'asked' | 'plans' | 'laugh';
const DECK: { key: DeckKey; obj: ObjName; Icon: IconType; label: string }[] = [
  { key: 'asked', obj: 'bell', Icon: IconForYou, label: 'Asked you' },
  { key: 'plans', obj: 'note', Icon: IconDecision, label: 'Plans' },
  { key: 'laugh', obj: 'popper', Icon: IconLaugh, label: 'Why they laughed' },
];

export function CardDeck({ cards, ringing, nudgeId }: { cards: Record<DeckKey, ReactNode>; ringing: boolean; nudgeId?: string | number }) {
  const [pick, setPick] = useState<DeckKey>(ringing ? 'asked' : 'plans');
  const [dir, setDir] = useState<'l' | 'r'>('r');
  // A live question for you always turns the bell card face up.
  useEffect(() => { if (nudgeId) { setDir('l'); setPick('asked'); } }, [nudgeId]);
  const idx = DECK.findIndex((d) => d.key === pick);
  const go = (k: DeckKey) => { const j = DECK.findIndex((d) => d.key === k); if (j === idx) return; setDir(j > idx ? 'r' : 'l'); setPick(k); };
  const step = (d: 1 | -1) => go(DECK[(idx + d + DECK.length) % DECK.length].key);
  const x0 = useRef<number | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  return (
    <div className="flex min-h-0 flex-[1_1_48%] flex-col px-3 pt-1">
      <div role="tablist" aria-label="On the table" className="flex h-14 shrink-0 items-center justify-center gap-6"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          const j = (idx + (e.key === 'ArrowRight' ? 1 : -1) + DECK.length) % DECK.length;
          go(DECK[j].key); tabs.current[j]?.focus();
        }}>
        {DECK.map((d, j) => {
          const on = d.key === pick;
          return (
            <button key={d.key} ref={(el) => { tabs.current[j] = el; }} type="button" role="tab" id={`deck-tab-${d.key}`} aria-selected={on} aria-controls="deck-panel"
              tabIndex={on ? 0 : -1} onClick={() => go(d.key)} aria-label={d.label + (d.key === 'asked' && ringing ? ' (someone asked you)' : '')}
              className={cn('relative flex h-14 w-16 cursor-pointer items-center justify-center rounded-full transition-[transform,opacity] duration-200',
                on ? '-translate-y-0.5 opacity-100' : 'opacity-60 hover:opacity-90')}>
              <span className={cn('inline-flex', d.key === 'asked' && ringing && 'imt-ring')}><ObjIcon name={d.obj} fallback={d.Icon} size={on ? 42 : 36} /></span>
              {on && <span aria-hidden className="absolute bottom-0.5 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-full bg-cream/80" />}
              {d.key === 'asked' && ringing && <span aria-hidden className="absolute top-2 right-1 size-2.5 rounded-full bg-lamplight ring-2 ring-dusk" />}
            </button>
          );
        })}
      </div>
      <div id="deck-panel" role="tabpanel" aria-labelledby={`deck-tab-${pick}`}
        className="relative min-h-0 flex-1 touch-pan-y"
        onPointerDown={(e) => { x0.current = e.clientX; }}
        onPointerUp={(e) => { if (x0.current == null) return; const dx = e.clientX - x0.current; x0.current = null; if (Math.abs(dx) > 48) step(dx < 0 ? 1 : -1); }}
        onPointerCancel={() => { x0.current = null; }}>
        <div key={pick} className={cn('lay flex h-full min-h-0 flex-col', dir === 'r' ? 'imt-slide-r' : 'imt-slide-l')}>{cards[pick]}</div>
      </div>
    </div>
  );
}

/* ---------- objects on the table you can press ---------- */
export function TableObject({ obj, Icon, label, busyLabel, busy, onClick, invite, btnRef }: {
  obj: ObjName; Icon: IconType; label: string; busyLabel?: string; busy?: boolean; onClick: () => void; invite?: boolean; btnRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button ref={btnRef} type="button" onClick={onClick} disabled={busy} aria-busy={busy} aria-label={label}
      className={cn('group flex min-h-[5.5rem] flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1 transition-transform duration-200 active:translate-x-px active:translate-y-px disabled:cursor-default',
        invite && 'imt-invite')}>
      <span className="transition-transform duration-200 group-hover:-translate-y-0.5"><ObjIcon name={obj} fallback={Icon} size={64} /></span>
      <span className="text-[1rem] font-semibold text-cream [text-shadow:1px_2px_3px_rgb(27_20_16/.8)]">{busy && busyLabel ? busyLabel : label}</span>
    </button>
  );
}

export const SpeakObject = ({ onClick, btnRef }: { onClick: () => void; btnRef: Ref<HTMLButtonElement> }) =>
  <TableObject obj="mug" Icon={IconSpeakForMe} label="Speak for me" onClick={onClick} btnRef={btnRef} />;
export const CatchUpObject = ({ onClick, busy, invite }: { onClick: () => void; busy: boolean; invite: boolean }) =>
  <TableObject obj="placemat" Icon={IconCatchUp} label="Catch me up" busyLabel="Catching you up…" busy={busy} invite={invite} onClick={onClick} />;

/* ---------- the whole place setting ---------- */
export function PhoneTable({ header, lamp, placemat, deck, objects }: {
  header: HeaderProps; lamp: TableLampState; placemat: ReactNode; deck: ReactNode; objects: ReactNode;
}) {
  return (
    <div className="relative mx-auto flex h-dvh max-w-xl flex-col overflow-hidden pt-[env(safe-area-inset-top)]">
      {/* the room beyond the lamp's reach: the top edge of the table falls into shadow */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-dusk/40 to-transparent" />
      <TopRow {...header} tableLamp={lamp} />
      {placemat}
      {deck}
      <nav aria-label="On the table in front of you" className="flex shrink-0 items-end gap-3 px-6 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {objects}
      </nav>
    </div>
  );
}
