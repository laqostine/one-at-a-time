// VOICEID_DUMP=1: save real audio (enrollment clips + identified segments) as 16 kHz WAV under server/data/voice/
// so the speaker model and thresholds can be measured on REAL voices offline (tools/voiceid-test.mjs --real).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = process.env.VOICEID_DUMP_DIR ?? resolve(import.meta.dirname, '../data/voice');
const ON = () => process.env.VOICEID_DUMP === '1';
let n = 0;

function wav(pcm16: Buffer, rate = 16000): Buffer {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm16.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm16.length, 40);
  return Buffer.concat([h, pcm16]);
}

export function dumpClip(kind: 'enroll' | 'seg', pcm16: Buffer, label: string, score?: number): void {
  if (!ON() || pcm16.length < 3200) return;
  try {
    mkdirSync(DIR, { recursive: true });
    const safe = label.replace(/[^\w-]+/g, '_').slice(0, 30) || 'x';
    const f = `${Date.now()}-${String(n++).padStart(4, '0')}-${kind}-${safe}${score != null ? `-${Math.round(score * 100)}` : ''}.wav`;
    writeFileSync(resolve(DIR, f), wav(pcm16));
  } catch { /* disk full or read-only: never break the live path */ }
}
