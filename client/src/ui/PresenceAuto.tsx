// Picks the 3D presence when WebGL is available, the 2D canvas presence otherwise.
import { Presence, type PresenceState } from './Presence';
import { Presence3D, hasWebGL } from './Presence3D';
import { PresenceHalo } from './PresenceHalo';

export function PresenceAuto(props: {
  state: PresenceState;
  level: number;
  size?: number;
  envelope?: Float32Array;
  envelopeStepMs?: number;
  /** Increment to fire a brief amber "addressed to you" flare. */
  flare?: number;
  halo?: boolean;
}) {
  if (hasWebGL()) return <Presence3D {...props} />;
  const { state, level, size = 96, flare, halo = true } = props;
  return (
    <div className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {halo && <PresenceHalo state={state} flare={flare} />}
      <div className="relative"><Presence state={state} level={level} size={size} /></div>
    </div>
  );
}
