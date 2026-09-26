// Picks the 3D presence when WebGL is available, the 2D canvas presence otherwise.
import { Presence, type PresenceState } from './Presence';
import { Presence3D, hasWebGL } from './Presence3D';

export function PresenceAuto(props: {
  state: PresenceState;
  level: number;
  size?: number;
  envelope?: Float32Array;
  envelopeStepMs?: number;
}) {
  if (hasWebGL()) return <Presence3D {...props} />;
  const { state, level, size } = props;
  return <Presence state={state} level={level} size={size} />;
}
