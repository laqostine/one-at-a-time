// Soft radial glow behind the presence, tinted by state; an amber ring blooms on each `flare`.
// Pure CSS (opacity/transform only), so it costs nothing next to the WebGL canvas.
import type { PresenceState } from './Presence';

const TINT: Record<PresenceState, string> = {
  idle: 'rgb(163 154 140 / .22)',
  listening: 'rgb(141 182 255 / .34)',
  transcribing: 'rgb(127 216 255 / .36)',
  thinking: 'rgb(185 157 255 / .36)',
  speaking: 'rgb(111 214 164 / .38)',
};

export function PresenceHalo({ state, flare = 0 }: { state: PresenceState; flare?: number }) {
  return (
    <>
      <span aria-hidden className={`pointer-events-none absolute inset-[-18%] rounded-full transition-[background] duration-700 ${state === 'idle' ? '' : 'imt-breathe'}`}
        style={{ background: `radial-gradient(closest-side, ${TINT[state]}, transparent 100%)` }} />
      {flare > 0 && (
        <span key={flare} aria-hidden className="imt-flare pointer-events-none absolute inset-[-24%] rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgb(246 185 59 / .55), rgb(246 185 59 / .18) 60%, transparent 100%)' }} />
      )}
    </>
  );
}
