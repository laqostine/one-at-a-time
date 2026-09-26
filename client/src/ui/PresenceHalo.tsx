// Soft radial glow behind the presence, tinted by state; an amber ring blooms on each `flare`.
// Pure CSS (opacity/transform only), so it costs nothing next to the WebGL canvas.
import type { PresenceState } from './Presence';
import { FLARE_HEX, PRESENCE_HEX } from './presenceStates';

const ALPHA: Record<PresenceState, number> = { idle: 22, listening: 34, transcribing: 36, thinking: 36, speaking: 38 };
const tint = (s: PresenceState) => `color-mix(in srgb, ${PRESENCE_HEX[s]} ${ALPHA[s]}%, transparent)`;

export function PresenceHalo({ state, flare = 0 }: { state: PresenceState; flare?: number }) {
  return (
    <>
      <span aria-hidden className={`pointer-events-none absolute inset-[-18%] rounded-full transition-[background] duration-700 ${state === 'idle' ? '' : 'imt-breathe'}`}
        style={{ background: `radial-gradient(closest-side, ${tint(state)}, transparent 100%)` }} />
      {flare > 0 && (
        <span key={flare} aria-hidden className="imt-flare pointer-events-none absolute inset-[-24%] rounded-full"
          style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${FLARE_HEX} 55%, transparent), color-mix(in srgb, ${FLARE_HEX} 18%, transparent) 60%, transparent 100%)` }} />
      )}
    </>
  );
}
