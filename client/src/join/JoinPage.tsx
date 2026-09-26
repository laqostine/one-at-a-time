// "Put my phone on the table": your phone = your mic, labelled with your name on the listener's phone.
// Once joined the whole screen is the lamp: one color, one word. No transcript is shown here on purpose.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AsrMessage, PaceLevel } from '../../../shared/types';
import { startMic, type MicHandle } from '../audio/mic';
import { Lamp, lampTone } from './Lamp';
import { SayCard, type SayMsg } from './SayCard';
import { adoptTableVoiceParams, oneAtATime, playMp3, primeSpeech, speakLine, tableVoiceName, tableVoiceOn, unlockAudio } from '@/lib/clerkVoice';

type Phase = 'form' | 'starting' | 'live' | 'error';
type Link = 'connecting' | 'open' | 'reconnecting' | 'lost';

const NAME_KEY = 'imt.joinName';
const VOICE_LEVEL = 0.03;

function param(k: string): string {
  try { return new URLSearchParams(location.search).get(k)?.trim() ?? ''; } catch { return ''; }
}
function savedName(): string {
  const q = param('name');
  if (q) return q;
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}

interface Pace { wpm: number; level: PaceLevel; overlap: boolean; listenerName: string }
const BUZZ_EVERY_MS = 10_000;  // at most one vibration per 10 s
const NUDGE_WINDOW_MS = 10_000; // 2nd overlap / too-fast flip within this window...
const NUDGE_BACKOFF_MS = 30_000; // ...speaks "One at a time" once, then stays quiet this long

try { adoptTableVoiceParams(new URLSearchParams(location.search)); } catch { /* ignore */ }

type WakeLockLike = { release: () => Promise<void> };

export default function JoinPage() {
  const token = param('token');
  const hostParam = param('host');
  const [name, setName] = useState(savedName);
  const [phase, setPhase] = useState<Phase>(token ? 'form' : 'error');
  const [error, setError] = useState(token ? '' : 'This link is missing its table code. Ask the host to show the QR again.');
  const [link, setLink] = useState<Link>('connecting');
  const [muted, setMuted] = useState(false);
  const [level, setLevel] = useState(0);
  const [heardAt, setHeardAt] = useState(0);
  const mic = useRef<MicHandle | null>(null);
  const wake = useRef<WakeLockLike | null>(null);
  const mutedRef = useRef(false);
  const [pace, setPace] = useState<Pace | null>(null);
  const lastBuzz = useRef(0);
  const lastTone = useRef<string>('');
  // The lamp is the screen; a tap shows Mute / Leave for 6 s.
  const [revealUntil, setRevealUntil] = useState(0);
  // Spoken "One at a time" (only when the table has voice on): transition timestamps + last spoken.
  const lang = useRef('en');
  const flips = useRef<{ overlap: number[]; fast: number[] }>({ overlap: [], fast: [] });
  const prev = useRef({ overlap: false, fast: false });
  const lastNudge = useRef(0);
  const [say, setSay] = useState<SayMsg | null>(null);
  const dismissSay = useCallback(() => setSay(null), []);
  useEffect(() => {
    if (!revealUntil) return;
    const id = window.setTimeout(() => setRevealUntil(0), Math.max(0, revealUntil - Date.now()));
    return () => window.clearTimeout(id);
  }, [revealUntil]);

  useEffect(() => { document.title = 'Put my phone on the table · One at a time'; }, []);
  useEffect(() => () => { mic.current?.stop(); void wake.current?.release().catch(() => {}); }, []);

  const keepAwake = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } };
      wake.current = (await nav.wakeLock?.request('screen')) ?? null;
    } catch { /* unsupported or denied: not fatal */ }
  }, []);
  // Wake locks drop when the tab is hidden; re-take on return.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && phase === 'live') void keepAwake(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [phase, keepAwake]);

  const onMessage = useCallback((m: AsrMessage) => {
    if (m.type === 'pace') {
      setPace({ wpm: m.wpm, level: m.level, overlap: m.overlap, listenerName: m.listenerName });
      // Vibrate on every color change, max once per 10 s.
      const tone = lampTone({ wpm: m.wpm, level: m.level, overlap: m.overlap }, mutedRef.current);
      if (tone !== lastTone.current && lastTone.current !== '' && Date.now() - lastBuzz.current > BUZZ_EVERY_MS) {
        lastBuzz.current = Date.now();
        try { navigator.vibrate?.(120); } catch { /* unsupported */ }
      }
      lastTone.current = tone;
      // Voice nudge: the 2nd flip into overlap (or into too fast) within 10 s speaks softly, then backs off 30 s.
      const now = Date.now();
      const fast = m.level === 'too_fast';
      const hit = (k: 'overlap' | 'fast', on: boolean) => {
        if (on && !prev.current[k]) flips.current[k] = [...flips.current[k].filter((x) => now - x < NUDGE_WINDOW_MS), now];
        prev.current[k] = on;
        return flips.current[k].length >= 2;
      };
      const due = [hit('overlap', m.overlap), hit('fast', fast)].some(Boolean);
      if (due && tableVoiceOn() && now - lastNudge.current > NUDGE_BACKOFF_MS) {
        lastNudge.current = now;
        flips.current = { overlap: [], fast: [] };
        speakLine(oneAtATime(lang.current), { lang: lang.current, voice: tableVoiceName(), volume: 0.55 });
      }
      return;
    }
    if (m.type === 'say') {
      setSay({ name: m.name, text: m.text, t: m.t });
      try { navigator.vibrate?.(200); } catch { /* unsupported */ }
      // The clerk speaks: server audio (ElevenLabs) when present, else the device voice when the table has voice on.
      if (m.audio) playMp3(m.audio);
      else if (m.voice) speakLine(m.text, { lang: lang.current, voice: tableVoiceName() });
      return;
    }
    if (m.type !== 'status') return; // participants never see transcripts
    if (m.state === 'open') setLink('open');
    else if (m.state === 'connecting') {
      const again = !!m.detail?.startsWith('reconnect');
      setLink(again ? 'reconnecting' : 'connecting');
      // Upgrade 401s look like plain drops in the browser: ask the server if our link is still valid.
      if (again) void fetch(`/api/room/verify?token=${encodeURIComponent(token)}`).then((r) => {
        if (r.status === 401) { setError('This table link has expired. Ask the host for a new QR.'); setPhase('error'); mic.current?.stop(); mic.current = null; }
      }).catch(() => {});
    }
    else if (m.state === 'error') {
      if (m.detail === 'unauthorized') { setError('This table link has expired. Ask the host for a new QR.'); setPhase('error'); mic.current?.stop(); }
      else setLink('lost');
    } else if (m.state === 'closed') setLink('reconnecting');
  }, [token]);

  const onPcm = useCallback((f32: Float32Array) => {
    let sum = 0;
    for (let i = 0; i < f32.length; i++) sum += f32[i] * f32[i];
    const rms = Math.sqrt(sum / Math.max(1, f32.length));
    const lv = mutedRef.current ? 0 : Math.min(1, rms * 6);
    setLevel((p) => p * 0.4 + lv * 0.6);
    if (!mutedRef.current && rms > VOICE_LEVEL) setHeardAt(Date.now());
  }, []);

  const join = useCallback(async () => {
    const n = name.trim();
    if (!n) return;
    try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ }
    // The Join tap is the user gesture that lets this phone play the clerk's voice later.
    unlockAudio();
    primeSpeech();
    void fetch('/api/room/lang').then((r) => (r.ok ? r.json() : null)).then((j: { lang?: string } | null) => { if (j?.lang) lang.current = j.lang; }).catch(() => {});
    setPhase('starting');
    setError('');
    try {
      const r = await fetch(`/api/room/verify?token=${encodeURIComponent(token)}`);
      if (r.status === 401) { setError('This table link has expired. Ask the host for a new QR.'); setPhase('error'); return; }
    } catch { /* offline check failed: let the socket retry loop handle it */ }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Your browser blocks the microphone on this address. Open the https:// link from the host’s QR code.');
      setPhase('error');
      return;
    }
    try {
      setLink('connecting');
      mic.current = await startMic(onMessage, onPcm, { role: 'participant', name: n, token, maxReconnects: 1000 });
      mic.current.setMuted(mutedRef.current);
      setPhase('live');
      setRevealUntil(0);
      void keepAwake();
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      setError(/denied|NotAllowed|Permission/i.test(msg)
        ? 'Microphone permission was denied. Allow it in your browser settings and try again.'
        : `Couldn’t start your microphone: ${msg}`);
      setPhase('error');
    }
  }, [name, token, onMessage, onPcm, keepAwake]);

  const leave = useCallback(() => {
    mic.current?.stop();
    mic.current = null;
    void wake.current?.release().catch(() => {});
    setPhase('form');
    setLevel(0);
    setPace(null);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      mic.current?.setMuted(next);
      return next;
    });
  }, []);

  const host = pace?.listenerName && pace.listenerName !== 'the table' ? pace.listenerName : hostParam || 'the listener';
  const heard = link === 'open' && !muted && Date.now() - heardAt < 1500;
  const status = muted ? 'muted' : link === 'open' ? (heard ? 'heard' : 'on the table') : link === 'lost' ? 'retrying' : link === 'reconnecting' ? 'reconnecting' : 'connecting';
  void level;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[640px] flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-ink">
      <a href="/landing.html" className="w-fit pt-3 font-display-italic text-[18px]">One at a time</a>

      {phase === 'error' && (
        <div role="alert" className="my-auto py-10">
          <p className="font-display-italic text-[1.882rem] leading-[1.15]">{error}</p>
          {token && <button type="button" onClick={() => setPhase('form')} className="mt-6 h-16 w-full cursor-pointer rounded-full bg-amber text-[1.176rem] font-bold text-ink">Try again</button>}
        </div>
      )}

      {(phase === 'form' || phase === 'starting') && (
        <form className="my-auto flex flex-col gap-4 py-10" onSubmit={(e) => { e.preventDefault(); void join(); }}>
          <label className="block">
            <span className="mb-2 block text-[1.176rem] font-bold">Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={40}
              placeholder="e.g. Joyce" enterKeyHint="go"
              className="h-16 w-full rounded-xl border border-rule bg-cream px-4 text-[1.176rem] text-ink placeholder:text-ink-2" />
          </label>
          <button type="submit" disabled={!name.trim() || phase === 'starting'}
            className="h-16 w-full cursor-pointer rounded-full bg-amber text-[1.176rem] font-bold text-ink disabled:cursor-default disabled:opacity-40">
            {phase === 'starting' ? 'Starting the mic…' : 'Put me on the table'}
          </button>
          <p className="text-[1rem] leading-snug text-ink-2">Your phone is your mic. It changes color when it’s your turn to slow down.</p>
        </form>
      )}

      {phase === 'live' && (
        <Lamp pace={muted ? null : pace} muted={muted} host={host} name={name.trim()} status={status}
          onTap={() => setRevealUntil(Date.now() + 8_000)} />
      )}
      {phase === 'live' && revealUntil > 0 && (
        <div className="oat-in fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-35 flex gap-2">
          <button type="button" onClick={() => { toggleMute(); setRevealUntil(Date.now() + 8_000); }} aria-pressed={muted}
            className="h-14 min-w-24 cursor-pointer rounded-full bg-cream px-5 text-[1.05rem] font-bold text-ink">{muted ? 'Unmute' : 'Mute'}</button>
          <button type="button" onClick={() => { setRevealUntil(0); leave(); }}
            className="h-14 min-w-24 cursor-pointer rounded-full bg-ink px-5 text-[1.05rem] font-bold text-cream">Leave</button>
        </div>
      )}
      {say && <SayCard say={say} onDismiss={dismissSay} />}
      <div aria-live="assertive" aria-atomic="true" className="sr-only">{say ? `${say.name} says: ${say.text}` : ''}</div>
    </div>
  );
}
