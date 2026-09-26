// "Everyone joins" participant page: your phone = your mic, labelled with your name on the host.
// No transcript is shown here on purpose — the phone only sends audio.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import type { AsrMessage, PaceLevel } from '../../../shared/types';
import { startMic, type MicHandle } from '../audio/mic';
import { PresenceAuto } from '../ui/PresenceAuto';
import { IconOverlap, IconPace, IconPhoneMic, IconSpeakForMe } from '../ui/icons';
import { Lamp } from './Lamp';
import { SayCard, type SayMsg } from './SayCard';
import { Toggle } from '@/components/ui/toggle';

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
const PACE_MAX_WPM = 220;     // right edge of the bar
const BUZZ_EVERY_MS = 10_000; // at most one vibration per 10 s

/** The participant's main job: a big "am I easy to caption?" bar. */
function PaceBar({ pace }: { pace: Pace | null }) {
  const who = pace?.listenerName || 'the table';
  if (!pace) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5" data-testid="pace">
        <div className="flex items-center gap-1.5 card-label"><IconPace size={16} strokeWidth={2} />Your pace</div>
        <div className="mt-2 text-[3.5rem] leading-none font-bold text-muted tabular-nums">–</div>
        <p className="mt-2 text-body text-muted">Start talking — your speed shows here.</p>
      </div>
    );
  }
  const { wpm, level, overlap } = pace;
  const tone = overlap || level === 'too_fast' ? 'bad' : level === 'fast' ? 'warn' : 'good';
  const bar = tone === 'bad' ? 'bg-bad' : tone === 'warn' ? 'bg-warn' : 'bg-good';
  const border = tone === 'bad' ? 'border-bad' : tone === 'warn' ? 'border-warn' : 'border-good/60';
  const text = wpm === 0 ? `Talk normally — ${who} is following`
    : level === 'too_fast' ? `Too fast for ${who} to follow`
    : level === 'fast' ? `A bit fast for ${who}, slow down`
    : `Good pace for ${who}`;
  const pct = Math.min(100, Math.round((wpm / PACE_MAX_WPM) * 100));
  const mark = (w: number) => `${(w / PACE_MAX_WPM) * 100}%`;
  return (
    <div className={`rounded-2xl border-2 ${border} bg-card p-5 transition-colors duration-200`} data-testid="pace" data-level={level} data-overlap={overlap}>
      <div className="flex items-center gap-1.5 card-label"><IconPace size={16} strokeWidth={2} />Your pace</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-[4.5rem] leading-none font-bold tracking-tight tabular-nums ${tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-fg'}`} data-testid="pace-wpm">{wpm || '–'}</span>
        <span className="font-mono text-[0.85rem] font-medium text-muted">words / min</span>
      </div>
      <div className="mt-2 text-[1.2rem] leading-snug font-semibold" role="status" aria-live="polite">{text}</div>
      <div className="relative mt-4 h-5 w-full overflow-hidden rounded-full bg-card-2" role="meter" aria-label="Your speaking pace"
        aria-valuemin={0} aria-valuemax={PACE_MAX_WPM} aria-valuenow={wpm} aria-valuetext={`${wpm} words per minute, ${text}`}>
        <div className={`h-full origin-left rounded-full ${bar} transition-[width] duration-200`} style={{ width: `${pct}%` }} />
        <span aria-hidden className="absolute top-0 h-full w-0.5 bg-bg/70" style={{ left: mark(150) }} />
        <span aria-hidden className="absolute top-0 h-full w-1 -translate-x-1/2 bg-bg" style={{ left: mark(170) }} />
      </div>
      <div aria-hidden className="relative mt-1.5 h-4 text-[0.72rem] font-semibold text-muted tabular-nums">
        <span className="absolute -translate-x-1/2" style={{ left: mark(150) }}>150</span>
        <span className="absolute -translate-x-1/2" style={{ left: mark(170) }}>170</span>
      </div>
      {overlap && (
        <div role="alert" className="mt-4 flex items-center gap-2.5 rounded-xl border border-bad/40 bg-bad/12 px-3.5 py-2.5 text-[1.1rem] font-semibold text-bad" data-testid="pace-overlap">
          <IconOverlap size={22} className="shrink-0" />Two people talking, one at a time helps {who}
        </div>
      )}
    </div>
  );
}

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
  const wasAlarm = useRef(false);
  // Lamp mode (default ON once joined): the screen is a colored lamp; a tap shows controls for 8 s.
  const [lamp, setLamp] = useState(true);
  const [revealUntil, setRevealUntil] = useState(0);
  const [say, setSay] = useState<SayMsg | null>(null);
  const dismissSay = useCallback(() => setSay(null), []);
  useEffect(() => {
    if (!revealUntil) return;
    const id = window.setTimeout(() => setRevealUntil(0), Math.max(0, revealUntil - Date.now()));
    return () => window.clearTimeout(id);
  }, [revealUntil]);

  useEffect(() => { document.title = 'Join the table · I Missed That'; }, []);
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
      // One short buzz on the transition into "too fast" or "overlap", max once per 10 s.
      const alarm = m.level === 'too_fast' || m.overlap;
      if (alarm && !wasAlarm.current && Date.now() - lastBuzz.current > BUZZ_EVERY_MS) {
        lastBuzz.current = Date.now();
        try { navigator.vibrate?.(120); } catch { /* unsupported */ }
      }
      wasAlarm.current = alarm;
      return;
    }
    if (m.type === 'say') {
      setSay({ name: m.name, text: m.text, t: m.t });
      try { navigator.vibrate?.(200); } catch { /* unsupported */ }
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
      setLamp(true);
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

  const host = pace?.listenerName && pace.listenerName !== 'the table' ? pace.listenerName : hostParam || 'The host';
  const heard = link === 'open' && !muted && Date.now() - heardAt < 1500;
  const statusLine = muted ? 'Muted — the table can’t hear you'
    : link === 'open' ? (heard ? 'You’re being heard' : 'Connected — just talk normally')
    : link === 'lost' ? 'Connection lost — retrying…'
    : link === 'reconnecting' ? 'Reconnecting…' : 'Connecting…';
  const dot = muted ? 'bg-muted' : link === 'open' ? (heard ? 'bg-good imt-pulse' : 'bg-good') : 'bg-warn';

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header>
        <a href="/landing.html" className="wordmark text-[1.35rem]">I Missed That</a>
        <h1 className="mt-4 font-display-italic text-[2.6rem] leading-none">{phase === 'live' ? name.trim() : 'Join the table'}</h1>
        <p className="mt-2 text-body text-muted">
          Your phone is your mic. <span className="text-fg">{host}</span> sees your name, not your voice.
        </p>
      </header>

      {phase === 'error' && (
        <div role="alert" className="rounded-2xl border border-warn/50 bg-card p-5 text-body">{error}
          {token && <button type="button" onClick={() => setPhase('form')} className="mt-4 h-12 w-full cursor-pointer rounded-xl border border-border bg-card-2 font-semibold">Try again</button>}
        </div>
      )}

      {(phase === 'form' || phase === 'starting') && (
        <form className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5" onSubmit={(e) => { e.preventDefault(); void join(); }}>
          <label className="flex flex-col gap-2">
            <span className="card-label">Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={40}
              placeholder="e.g. Alex" enterKeyHint="go"
              className="h-14 rounded-xl border border-input bg-card-2 px-4 text-[1.2rem] text-fg outline-none transition-colors duration-150 focus:border-accent" />
          </label>
          <button type="submit" disabled={!name.trim() || phase === 'starting'}
            className="h-16 cursor-pointer rounded-2xl bg-accent text-[1.3rem] font-bold text-accent-fg shadow-[var(--glow-accent)] transition-[filter] duration-150 hover:brightness-110 disabled:cursor-default disabled:opacity-50">
            {phase === 'starting' ? 'Starting mic…' : 'Join'}
          </button>
        </form>
      )}
      {(phase === 'form' || phase === 'starting') && (
        <ul className="flex flex-col gap-1 rounded-2xl border border-border/70 p-2" aria-label="What happens after you join">
          {[
            { Icon: IconPhoneMic, title: 'Your phone is your mic', body: 'Every line you say carries your name.' },
            { Icon: IconPace, title: 'The screen becomes a lamp', body: `Green is easy for ${host === 'The host' ? 'the host' : host} to follow. Amber or red means slow down.` },
            { Icon: IconSpeakForMe, title: `${host} can answer you here`, body: 'Their typed line fills your screen for 10 seconds.' },
          ].map(({ Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3 rounded-xl px-2.5 py-2.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/8 text-accent"><Icon size={22} /></span>
              <span className="min-w-0"><span className="block font-semibold">{title}</span><span className="block text-[0.95rem] leading-snug text-muted">{body}</span></span>
            </li>
          ))}
        </ul>
      )}

      {phase === 'live' && (
        <section className="flex flex-col gap-4" aria-live="polite">
          <PaceBar pace={muted ? null : pace} />
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <PresenceAuto size={96} state={muted ? 'idle' : link === 'open' ? (heard ? 'speaking' : 'listening') : 'idle'} level={level} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span aria-hidden className={`h-3 w-3 shrink-0 rounded-full ${dot}`} />
                  <div className="text-[1.05rem] leading-snug font-semibold" role="status">{statusLine}</div>
                </div>
                <div className="mt-0.5 truncate text-meta">Joined as <b className="text-fg">{name.trim()}</b></div>
                <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-card-2" role="meter" aria-label="Mic level"
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
                  <div className={`h-full rounded-full transition-[width] duration-100 ${heard ? 'bg-good' : 'bg-accent'}`}
                    style={{ width: `${Math.round(level * 100)}%` }} />
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
              <Toggle pressed={muted} onPressedChange={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}
                className={`h-14 cursor-pointer rounded-xl border text-[1.15rem] font-bold [&_svg:not([class*='size-'])]:size-6 ${muted ? 'border-bad bg-bad text-black hover:bg-bad hover:text-black data-[state=on]:bg-bad data-[state=on]:text-black' : 'border-border bg-card-2 text-fg'}`}>
                {muted ? <MicOff aria-hidden /> : <Mic aria-hidden />}
                {muted ? 'Unmute' : 'Mute'}
              </Toggle>
              <Toggle pressed={lamp} onPressedChange={(v) => { setLamp(v); setRevealUntil(0); }} aria-label="Lamp mode: the whole screen shows your pace as a color"
                data-testid="lamp-toggle"
                className="h-14 cursor-pointer rounded-xl border border-border bg-card-2 px-4 text-[1.05rem] font-bold text-fg data-[state=on]:border-good data-[state=on]:bg-good/15 data-[state=on]:text-good">
                <span aria-hidden className="size-3 rounded-full bg-current" /> Lamp
              </Toggle>
              <button type="button" onClick={leave} className="h-14 cursor-pointer rounded-xl border border-border px-4 font-semibold text-muted transition-colors duration-150 hover:text-fg">Leave</button>
            </div>
          </div>
        </section>
      )}

      <p className="mt-auto text-meta">Your voice is transcribed with your name for this table only. Nothing is stored.</p>

      {phase === 'live' && lamp && !revealUntil && (
        <Lamp pace={pace} muted={muted} host={host} name={name.trim()} heard={heard} level={level}
          onReveal={() => setRevealUntil(Date.now() + 8_000)} />
      )}
      {phase === 'live' && lamp && revealUntil > 0 && (
        <p role="status" className="fixed inset-x-0 bottom-0 z-20 bg-card-2/95 py-2 text-center font-mono text-[0.72rem] tracking-wider text-muted uppercase">Lamp returns in a few seconds</p>
      )}
      {say && <SayCard say={say} onDismiss={dismissSay} />}
      <div aria-live="assertive" aria-atomic="true" className="sr-only">{say ? `${say.name} wants to say: ${say.text}` : ''}</div>
    </div>
  );
}
