// Streams synthesized speech into the server as named participants (like phones).
// Usage: node tools/fake-phones.mjs [wsBase=ws://localhost:8787] [scenario=client/public/replay/demo1.json]
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import WebSocket from '/Users/bera/Documents/GitHub/bainsahack/server/node_modules/ws/index.js';

const base = process.argv[2] ?? 'ws://localhost:8787';
const scenario = JSON.parse(readFileSync(process.argv[3] ?? 'client/public/replay/demo1.json', 'utf8'));
const token = JSON.parse(execSync(`curl -s ${base.replace('ws', 'http')}/api/room`).toString()).token;
const names = scenario.names ?? { 0: 'Alex', 1: 'Sam', 2: 'Priya' };
const voices = { 0: 'Daniel', 1: 'Samantha', 2: 'Karen' };
mkdirSync('/tmp/imt-tts', { recursive: true });

function pcm16k(text, voice) {
  const key = Buffer.from(text + voice).toString('base64url').slice(0, 40);
  const aiff = `/tmp/imt-tts/${key}.aiff`, raw = `/tmp/imt-tts/${key}.raw`;
  if (!existsSync(raw)) {
    execSync(`say -v "${voice}" -r 185 -o "${aiff}" ${JSON.stringify(text)}`);
    execSync(`ffmpeg -loglevel error -y -i "${aiff}" -ac 1 -ar 16000 -f s16le "${raw}"`);
  }
  return readFileSync(raw);
}

const socks = {};
for (const [id, name] of Object.entries(names)) {
  const ws = new WebSocket(`${base}/ws/audio?role=participant&name=${encodeURIComponent(name)}&token=${token}`);
  ws.on('message', (m) => { const j = JSON.parse(m.toString()); if (j.type === 'pace') console.log(`[pace ${name}] ${j.wpm} wpm ${j.level}${j.overlap ? ' OVERLAP' : ''}`); if (j.type === 'status') console.log(`[status ${name}]`, j.state, j.detail ?? ''); });
  socks[id] = new Promise((res) => ws.on('open', () => res(ws)));
}
await Promise.all(Object.values(socks));
console.log('all participants connected; streaming scenario…');

const t0 = Date.now();
const lines = scenario.lines.filter((l) => l.text).sort((a, b) => a.t - b.t);
for (const l of lines) {
  const wait = l.t - (Date.now() - t0);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const ws = await socks[l.speaker];
  const buf = pcm16k(l.text, voices[l.speaker] ?? 'Alex');
  console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${names[l.speaker]}: ${l.text}`);
  // stream in 100ms chunks (3200 bytes) in real time
  const chunk = 3200;
  for (let i = 0; i < buf.length; i += chunk) {
    ws.send(buf.subarray(i, i + chunk));
    await new Promise((r) => setTimeout(r, 100));
  }
}
await new Promise((r) => setTimeout(r, 4000));
for (const p of Object.values(socks)) (await p).send(JSON.stringify({ type: 'stop' }));
console.log('done');
process.exit(0);
