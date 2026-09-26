// Record N seconds of 16 kHz mono PCM16 from the mic, using the same AudioWorklet downsampler as the live stream
// (same browser DSP: echo cancel / noise suppression / AGC, so enrolled voices look like live ones).
import { workletSource, WORKLET_NAME } from '../audio/worklet';
import { MIC_CONSTRAINTS, cleanChain } from '../audio/clean';

export interface Recording { pcm: Int16Array; ms: number }

export async function recordPcm16(seconds: number, onLevel?: (rms: number, elapsedMs: number) => void): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
  const ctx = new AudioContext();
  const blobUrl = URL.createObjectURL(new Blob([workletSource], { type: 'application/javascript' }));
  try { await ctx.audioWorklet.addModule(blobUrl); } finally { URL.revokeObjectURL(blobUrl); }
  if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);

  const src = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, WORKLET_NAME, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
  const sink = ctx.createGain();
  sink.gain.value = 0;
  cleanChain(ctx, src).connect(node).connect(sink).connect(ctx.destination);

  const target = seconds * 16_000;
  const chunks: Int16Array[] = [];
  let n = 0;
  try {
    await new Promise<void>((resolve) => {
      node.port.onmessage = (ev: MessageEvent<{ pcm: ArrayBuffer; f32: ArrayBuffer }>) => {
        const pcm = new Int16Array(ev.data.pcm);
        chunks.push(pcm);
        n += pcm.length;
        if (onLevel) {
          const f = new Float32Array(ev.data.f32);
          let s = 0;
          for (let i = 0; i < f.length; i++) s += f[i] * f[i];
          onLevel(Math.sqrt(s / (f.length || 1)), (n / 16_000) * 1000);
        }
        if (n >= target) resolve();
      };
    });
  } finally {
    node.port.onmessage = null;
    try { src.disconnect(); node.disconnect(); sink.disconnect(); } catch { /* ignore */ }
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => undefined);
  }
  const out = new Int16Array(Math.min(n, target));
  let off = 0;
  for (const c of chunks) {
    if (off >= out.length) break;
    const take = c.subarray(0, out.length - off);
    out.set(take, off);
    off += take.length;
  }
  return { pcm: out, ms: (out.length / 16_000) * 1000 };
}
