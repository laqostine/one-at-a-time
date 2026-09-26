// "Everyone joins" participant page: your phone = your mic, labelled with your name on the host.
// No transcript is shown here on purpose — the phone only sends audio.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import type { AsrMessage } from '../../../shared/types';
import { startMic, type MicHandle } from '../audio/mic';
import { Presence } from '../ui/Presence';

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

type WakeLockLike = { release: () => Promise<void> };

export default function JoinPage() {
  const token = param('token');
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
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      mic.current?.setMuted(next);
      return next;
    });
  }, []);

  const heard = link === 'open' && !muted && Date.now() - heardAt < 1500;
  const statusLine = muted ? 'Muted — the table can’t hear you'
    : link === 'open' ? (heard ? 'You’re being heard' : 'Connected — just talk normally')
    : link === 'lost' ? 'Connection lost — retrying…'
    : link === 'reconnecting' ? 'Reconnecting…' : 'Connecting…';
  const dot = muted ? 'bg-muted' : link === 'open' ? (heard ? 'bg-good imt-pulse' : 'bg-good') : 'bg-warn';

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header>
        <div className="text-sm font-semibold tracking-wide text-accent uppercase">I Missed That</div>
        <h1 className="mt-1 text-2xl font-bold">Join the table</h1>
        <p className="mt-1 text-muted">Your phone becomes your microphone, so captions show your name.</p>
      </header>

      {phase === 'error' && (
        <div role="alert" className="rounded-2xl border border-warn/50 bg-card p-4 text-[1.05rem]">{error}
          {token && <button type="button" onClick={() => setPhase('form')} className="mt-4 h-12 w-full rounded-xl bg-card-2 font-semibold">Try again</button>}
        </div>
      )}

      {(phase === 'form' || phase === 'starting') && (
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void join(); }}>
          <label className="flex flex-col gap-2">
            <span className="font-semibold">Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={40}
              placeholder="e.g. Alex" enterKeyHint="go"
              className="h-14 rounded-xl border border-line bg-card px-4 text-[1.2rem] text-fg outline-none focus:border-accent" />
          </label>
          <button type="submit" disabled={!name.trim() || phase === 'starting'}
            className="h-16 rounded-2xl bg-accent text-[1.3rem] font-bold text-black disabled:opacity-50">
            {phase === 'starting' ? 'Starting mic…' : 'Join'}
          </button>
        </form>
      )}

      {phase === 'live' && (
        <section className="flex flex-col gap-5" aria-live="polite">
          <div className="rounded-2xl border border-line bg-card p-5">
            <div className="flex items-center gap-3">
              <Presence size={32} state={muted ? 'idle' : link === 'open' ? (heard ? 'speaking' : 'listening') : 'idle'} level={level} />
              <span aria-hidden className={`h-3.5 w-3.5 shrink-0 rounded-full ${dot}`} />
              <div className="text-[1.15rem] font-semibold" role="status">{statusLine}</div>
            </div>
            <div className="mt-1 text-muted">Joined as <b className="text-fg">{name.trim()}</b></div>
            <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-card-2" role="meter" aria-label="Mic level"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
              <div className={`h-full rounded-full transition-[width] duration-100 ${heard ? 'bg-good' : 'bg-accent'}`}
                style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
          </div>
          <button type="button" onClick={toggleMute} aria-pressed={muted}
            className={`flex h-16 items-center justify-center gap-3 rounded-2xl text-[1.2rem] font-bold ${muted ? 'bg-bad text-black' : 'bg-card-2 text-fg'}`}>
            {muted ? <MicOff size={24} aria-hidden /> : <Mic size={24} aria-hidden />}
            {muted ? 'Unmute' : 'Mute'}
          </button>
          <p className="text-muted">Keep this screen open and your phone on the table in front of you.</p>
          <button type="button" onClick={leave} className="h-12 rounded-xl border border-line text-muted">Leave</button>
        </section>
      )}

      <p className="mt-auto text-sm text-muted">Your voice is transcribed with your name for this table only. Nothing is stored.</p>
    </div>
  );
}
