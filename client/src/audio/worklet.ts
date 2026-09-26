// AudioWorklet source (loaded via Blob URL). Downsamples input (ctx.sampleRate) to 16kHz mono
// and posts ~100ms chunks: { pcm: ArrayBuffer (Int16 LE), f32: ArrayBuffer (Float32) }.
export const WORKLET_NAME = 'pcm16-downsampler';

export const workletSource = `
class Downsampler extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.chunk = 1600; // 100ms @ 16k
    this.out = new Float32Array(this.chunk);
    this.n = 0;
    this.pos = 0;   // fractional read position into the virtual input stream
    this.acc = 0;   // box-filter accumulator
    this.accN = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0]) return true;
    const chs = input.length;
    const len = input[0].length;
    for (let i = 0; i < len; i++) {
      let s = 0;
      for (let c = 0; c < chs; c++) s += input[c][i];
      s /= chs;
      this.acc += s; this.accN++;
      this.pos += 1;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        this.out[this.n++] = this.acc / this.accN;
        this.acc = 0; this.accN = 0;
        if (this.n === this.chunk) this.flush();
      }
    }
    return true;
  }
  flush() {
    const f32 = this.out.slice(0, this.n);
    const pcm = new Int16Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const v = Math.max(-1, Math.min(1, f32[i]));
      pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    this.n = 0;
    this.port.postMessage({ pcm: pcm.buffer, f32: f32.buffer }, [pcm.buffer, f32.buffer]);
  }
}
registerProcessor('${WORKLET_NAME}', Downsampler);
`;
