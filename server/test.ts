// Run: npx tsx server/test.ts   (from repo root) — calls the engine directly, no HTTP.
import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url) });

const { catchUp, extractState, explainLaugh, hasAnthropic } = await import('./src/claude.ts');
const { me, speakers, timeline, existingLedger, LAUGH_T, NOW_T } = await import('./src/fixtures.ts');

console.log(`mode: ${hasAnthropic() ? 'LIVE (Anthropic)' : 'MOCK (no ANTHROPIC_API_KEY in .env)'}\n`);

async function timed<T>(label: string, fn: () => Promise<T>) {
  const t0 = Date.now();
  const out = await fn();
  console.log(`=== ${label} (${Date.now() - t0} ms) ===`);
  console.log(JSON.stringify(out, null, 2), '\n');
  return out;
}

await timed('catchUp (last 60s)', () =>
  catchUp({ me, speakers, window: timeline.filter((i) => (i.type === 'utterance' ? i.tStart : i.t) >= NOW_T - 60_000), sinceT: NOW_T - 60_000, nowT: NOW_T }));

const s1 = await timed('extractState (full window, seeded ledger)', () =>
  extractState({ me, speakers, window: timeline, nowT: NOW_T, existing: existingLedger }));

await timed('extractState (re-run with its own output — ids should be stable)', () =>
  extractState({ me, speakers, window: timeline, nowT: NOW_T + 5000, existing: s1.ledger }));

await timed('explainLaugh', () =>
  explainLaugh({ speakers, window: timeline.filter((i) => (i.type === 'utterance' ? i.tStart : i.t) <= LAUGH_T), t: LAUGH_T }));
