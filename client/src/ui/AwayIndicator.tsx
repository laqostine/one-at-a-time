import { Camera, EyeOff } from 'lucide-react';

/** Always-visible camera dot while "Notice when I look away" is on, plus an "Away" pill while away. */
export function AwayIndicator({ enabled, active, away, sim }: { enabled: boolean; active: boolean; away: boolean; sim: boolean }) {
  if (!enabled) return null;
  const tip = sim
    ? 'Look-away simulator (press A to toggle)'
    : active ? 'Camera on for look-away detection. On-device only, nothing stored or sent.' : 'Starting camera (on-device only, nothing stored)…';
  return (
    <span className="flex shrink-0 items-center gap-1.5" data-testid="away-indicator">
      {away && (
        <span role="status" className="flex items-center gap-1 rounded-full bg-warn px-2.5 py-1 text-[0.8rem] font-bold text-black">
          <EyeOff size={14} aria-hidden /> Away
        </span>
      )}
      <span title={tip} aria-label={tip} role="img"
        className={`flex items-center gap-1 rounded-full border px-1.5 py-1 text-[0.7rem] ${active ? 'border-good/60 text-good' : 'border-line text-muted'}`}>
        <Camera size={14} aria-hidden />
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-good' : 'bg-muted'}`} />
      </span>
    </span>
  );
}
