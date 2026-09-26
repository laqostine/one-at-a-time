// "Clean it, then send it": one cleanup chain for every mic (live host, phones, voice enrollment) so Deepgram and
// the voice prints always see the same audio. Browser DSP first (echo cancel, noise suppression, AGC, voice isolation
// where the browser has it), then: high-pass 90 Hz (table thumps, handling noise, HVAC), a gentle compressor that
// levels a quiet speaker at the far end of the table with a loud one next to the phone, and make-up gain.
export const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    channelCount: { ideal: 1 },
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    // Chrome/Safari voice isolation (ignored where unsupported; never a hard requirement).
    ...({ voiceIsolation: true } as MediaTrackConstraints),
  },
};

export function cleanChain(ctx: AudioContext, src: AudioNode): AudioNode {
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 90; hp.Q.value = 0.7;
  const presence = ctx.createBiquadFilter(); // a touch of clarity where consonants live
  presence.type = 'peaking'; presence.frequency.value = 3000; presence.Q.value = 0.8; presence.gain.value = 2;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -28; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.25;
  const makeup = ctx.createGain();
  makeup.gain.value = 1.6;
  src.connect(hp).connect(presence).connect(comp).connect(makeup);
  return makeup;
}
