// Mic capture -> 16k PCM16 over WS /ws/audio -> AsrMessage callbacks.
import type { AsrMessage } from '../../../shared/types';
import { workletSource, WORKLET_NAME } from './worklet';

export interface MicHandle { stop: () => void }

const MAX_RECONNECTS = 3;

export async function startMic(
  onMessage: (m: AsrMessage) => void,
  onPcm?: (f32: Float32Array, sampleRate: number) => void,
): Promise<MicHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const ctx = new AudioContext();
  const blobUrl = URL.createObjectURL(new Blob([workletSource], { type: 'application/javascript' }));
  try {
    await ctx.audioWorklet.addModule(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
  if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);

  const src = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, WORKLET_NAME, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
  const sink = ctx.createGain();
  sink.gain.value = 0; // keep graph pulling without audible output
  src.connect(node).connect(sink).connect(ctx.destination);

  let stopped = false;
  let ws: WebSocket | null = null;
  let reconnects = 0;
  let fatal = false; // server has no key: don't bother reconnecting
  const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/audio`;

  const connect = () => {
    const sock = new WebSocket(wsUrl);
    sock.binaryType = 'arraybuffer';
    ws = sock;
    sock.onopen = () => { reconnects = 0; };
    sock.onmessage = (ev: MessageEvent) => {
      if (typeof ev.data !== 'string') return;
      let m: AsrMessage;
      try { m = JSON.parse(ev.data) as AsrMessage; } catch { return; }
      if (m.type === 'status' && m.state === 'error' && m.detail?.includes('DEEPGRAM_API_KEY')) fatal = true;
      onMessage(m);
    };
    sock.onclose = () => {
      if (stopped || fatal || ws !== sock) return;
      if (reconnects < MAX_RECONNECTS) {
        reconnects++;
        onMessage({ type: 'status', state: 'connecting', detail: `reconnect ${reconnects}/${MAX_RECONNECTS}` });
        setTimeout(() => { if (!stopped) connect(); }, 500 * reconnects);
      } else {
        onMessage({ type: 'status', state: 'error', detail: 'audio socket lost' });
      }
    };
    sock.onerror = () => { /* onclose handles it */ };
  };
  connect();

  node.port.onmessage = (ev: MessageEvent<{ pcm: ArrayBuffer; f32: ArrayBuffer }>) => {
    const { pcm, f32 } = ev.data;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(pcm);
    if (onPcm) {
      try { onPcm(new Float32Array(f32), 16000); } catch (e) { console.warn('[mic] onPcm failed', e); }
    }
  };

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      const sock = ws;
      if (sock) {
        if (sock.readyState === WebSocket.OPEN) {
          sock.send(JSON.stringify({ type: 'stop' }));
          sock.close(1000, 'stop');
        } else if (sock.readyState === WebSocket.CONNECTING) {
          sock.close();
        }
      }
      node.port.onmessage = null;
      try { src.disconnect(); node.disconnect(); sink.disconnect(); } catch { /* ignore */ }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => undefined);
    },
  };
}
