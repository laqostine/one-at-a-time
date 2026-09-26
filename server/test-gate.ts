// Run: cd server && npx tsx test-gate.ts   — live /api/gate engine check (no HTTP): 6 fixture lines, 3 addressed to Bera.
import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url) });

const { gate, GATE_MAX_TOKENS } = await import('./src/gate.ts');
const { hasAnthropic } = await import('./src/claude.ts');
const { me, speakers } = await import('./src/fixtures.ts');
import type { TimelineItem, Utterance } from '../shared/types.ts';

let n = 0;
const u = (speaker: number, sec: number, text: string): Utterance =>
  ({ id: `g${++n}`, type: 'utterance', speaker, text, tStart: sec * 1000, tEnd: sec * 1000 + 2500, final: true });

const recent: TimelineItem[] = [
  u(0, 0, 'Okay, quick sync before everyone scatters.'),
  u(1, 3, "Diarization still flaps on crosstalk, I don't love Friday."),
  u(0, 6, 'We have the investor demo Thursday and nothing is prepared.'),
  u(2, 8, 'Bera built the pitch deck last time and it was great.'),
];

const cases: { utt: Utterance; addressed: boolean }[] = [
  { utt: u(0, 10, 'Bera, can you own the demo script by Friday?'), addressed: true },
  { utt: u(2, 14, 'Can someone own the deck again this time?'), addressed: true },
  { utt: u(1, 18, "What do you think, Bera, is Monday safer?"), addressed: true },
  { utt: u(0, 22, "Okay, let's lock it: soft launch Friday, flag flip Monday."), addressed: false },
  { utt: u(1, 26, "I'd put it behind the Pro tier, it's expensive to run."), addressed: false },
  { utt: u(2, 30, 'Ha, my laptop battery would die before the meeting ends.'), addressed: false },
];

console.log(`mode: ${hasAnthropic() ? 'LIVE' : 'FALLBACK (no key)'}  max_tokens=${GATE_MAX_TOKENS}\n`);
// warm the connection (TLS + model routing) so the numbers reflect steady state
await gate({ me, speakers, recent: [], target: u(0, 0, 'warmup line nobody cares about ' + Date.now()) });

let tp = 0, fp = 0, fn = 0, tn = 0;
const lat: number[] = [];
for (const c of cases) {
  // unique suffix-free text => cache miss; LRU is exercised separately below
  const r = await gate({ me, speakers, recent, target: c.utt });
  lat.push(r.latencyMs);
  const said = r.addressed_to_me >= 0.6;
  if (said && c.addressed) tp++; else if (said) fp++; else if (c.addressed) fn++; else tn++;
  console.log(`${String(r.latencyMs).padStart(5)} ms  [${r.source}] addr=${r.addressed_to_me.toFixed(2)} ${said === c.addressed ? 'OK ' : 'MISS'} kind=${r.kind}(${r.kind_p}) urgent=${r.urgent}  :: ${c.utt.text}`);
}
const cached = await gate({ me, speakers, recent, target: cases[0].utt });
const mean = Math.round(lat.reduce((a, b) => a + b, 0) / lat.length);
console.log(`\nprecision=${(tp / Math.max(1, tp + fp)).toFixed(2)} recall=${(tp / Math.max(1, tp + fn)).toFixed(2)} (tp=${tp} fp=${fp} fn=${fn} tn=${tn})`);
console.log(`latency mean=${mean} ms  min=${Math.min(...lat)}  max=${Math.max(...lat)}  cache-hit=${cached.latencyMs} ms [${cached.source}]`);
