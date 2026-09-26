import type { EventKind } from '../../../shared/types';

export const EVENT_META: Record<EventKind, { icon: string; label: string }> = {
  laughter: { icon: '😂', label: 'laughter' },
  applause: { icon: '👏', label: 'applause' },
  cheering: { icon: '🎉', label: 'cheering' },
  alarm: { icon: '🚨', label: 'alarm' },
  doorbell: { icon: '🔔', label: 'doorbell' },
  knock: { icon: '🚪', label: 'knock' },
  phone: { icon: '📱', label: 'phone ringing' },
  music: { icon: '🎵', label: 'music' },
};

export function EventChip({ kind }: { kind: EventKind }) {
  const m = EVENT_META[kind] ?? { icon: '•', label: kind };
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-card-2 px-2 py-0.5 text-[0.8rem] text-muted">
      <span aria-hidden>{m.icon}</span>{m.label}
    </span>
  );
}
