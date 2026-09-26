import { AudioLines, Bell, DoorClosed, Hand, Laugh, Music, PartyPopper, PhoneCall, Siren } from 'lucide-react';
import type { EventKind } from '../../../shared/types';

type Icon = typeof Laugh;
export const EVENT_META: Record<EventKind, { icon: Icon; label: string }> = {
  laughter: { icon: Laugh, label: 'laughter' },
  applause: { icon: Hand, label: 'applause' },
  cheering: { icon: PartyPopper, label: 'cheering' },
  alarm: { icon: Siren, label: 'alarm' },
  doorbell: { icon: Bell, label: 'doorbell' },
  knock: { icon: DoorClosed, label: 'knock' },
  phone: { icon: PhoneCall, label: 'phone ringing' },
  music: { icon: Music, label: 'music' },
};
export const eventMeta = (kind: EventKind) => EVENT_META[kind] ?? { icon: AudioLines, label: kind };

/** Non-speech sound, inline in captions: icon + word (never icon alone). */
export function EventChip({ kind }: { kind: EventKind }) {
  const m = eventMeta(kind);
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-change/35 bg-change/10 px-2.5 text-[0.78rem] font-semibold text-change">
      <m.icon size={14} strokeWidth={2.4} aria-hidden />{m.label}
    </span>
  );
}
