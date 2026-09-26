#!/usr/bin/env node
// Renders spoken lines from a replay scenario JSON to per-line MP3s using
// macOS `say` + ffmpeg, so the stage demo can play recorded family voices in
// sync with the on-screen replay.
//
// Usage:
//   node tools/render-replay-audio.mjs demo2
//   node tools/render-replay-audio.mjs demo1
//
// Reads:  client/public/replay/<scenario>.json
// Writes: client/public/replay/audio/<scenario>/<index>.mp3
//         client/public/replay/audio/<scenario>/index.json
//
// index.json shape: { "<lineIndex>": { "file": "0.mp3", "ms": 2431 } }
// lineIndex is the position of the line in the scenario's `lines` array
// (events count toward the index too, so it lines up 1:1 with replay.ts's
// iteration over `scenario.lines`).

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const REPLAY_DIR = join(REPO_ROOT, 'client', 'public', 'replay');

// speaker id -> macOS `say` voice
const VOICES = { 0: 'Samantha', 1: 'Daniel', 2: 'Karen' };
const RATE = 185; // words per minute, matches the pace of the replay text scheduling

function isSpokenLine(item) {
  return typeof item.text === 'string' && typeof item.speaker === 'number';
}

function ffprobeDurationMs(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'quiet',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ], { encoding: 'utf8' }).trim();
  const seconds = parseFloat(out);
  return Math.round(seconds * 1000);
}

function renderScenario(scenarioName) {
  const jsonPath = join(REPLAY_DIR, `${scenarioName}.json`);
  if (!existsSync(jsonPath)) {
    throw new Error(`scenario not found: ${jsonPath}`);
  }
  const scenario = JSON.parse(readFileSync(jsonPath, 'utf8'));

  const outDir = join(REPLAY_DIR, 'audio', scenarioName);
  mkdirSync(outDir, { recursive: true });

  const tmpDir = os.tmpdir();
  const index = {};

  scenario.lines.forEach((item, i) => {
    if (!isSpokenLine(item)) return; // skip non-speech events (laughter, knock, ...)

    const voice = VOICES[item.speaker] ?? VOICES[0];
    const aiffPath = join(tmpDir, `replay-audio-${scenarioName}-${i}-${process.pid}.aiff`);
    const mp3Path = join(outDir, `${i}.mp3`);

    try {
      // Render speech to AIFF with the chosen voice + rate.
      execFileSync('say', ['-v', voice, '-r', String(RATE), '-o', aiffPath, item.text], { stdio: 'inherit' });

      // Downconvert to a tiny mono mp3 (22050 Hz, 32 kbps) — plenty for a
      // laptop-speaker demo, keeps the whole scenario well under ~2 MB.
      execFileSync('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-i', aiffPath,
        '-ac', '1',
        '-ar', '22050',
        '-b:a', '32k',
        mp3Path,
      ], { stdio: 'inherit' });

      const ms = ffprobeDurationMs(mp3Path);
      index[i] = { file: `${i}.mp3`, ms };
      console.log(`  [${scenarioName}] line ${i} (speaker ${item.speaker}, ${voice}): ${ms}ms -> ${mp3Path}`);
    } finally {
      if (existsSync(aiffPath)) rmSync(aiffPath, { force: true });
    }
  });

  const indexPath = join(outDir, 'index.json');
  writeFileSync(indexPath, JSON.stringify(index, null, 2));

  const totalBytes = Object.values(index).reduce((sum, entry) => {
    const p = join(outDir, entry.file);
    return sum + (existsSync(p) ? statSync(p).size : 0);
  }, 0);
  console.log(`[${scenarioName}] wrote ${Object.keys(index).length} clips, ${(totalBytes / 1024).toFixed(1)} KB total -> ${indexPath}`);
}

const scenarios = process.argv.slice(2);
if (scenarios.length === 0) {
  console.error('usage: node tools/render-replay-audio.mjs <scenario> [scenario2 ...]');
  process.exit(1);
}

for (const s of scenarios) {
  renderScenario(s);
}
