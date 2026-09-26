// Single-phone mode, enrollment: pass one phone around the table, each person says their name and one sentence,
// the server keeps a voice print per name (in memory, per table). Later the one listening phone names each
// sentence by voice. Cream / ink / amber, one sentence, one button, no icons (design/DESIGN.md).
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { recordPcm16 } from './record';

type Phase = 'ready' | 'recording' | 'saving' | 'done' | 'error';
interface Voice { name: string; samples: number }

const SECONDS = 5;
const QUIET_RMS = 0.01; // below this for the whole take = the mic heard nothing useful

function param(k: string): string {
  try { return new URLSearchParams(location.search).get(k)?.trim() ?? ''; } catch { return ''; }
}

const S: Record<string, CSSProperties> = {
  page: { minHeight: '100%', background: 'var(--cream)', color: 'var(--ink)', display: 'flex', justifyContent: 'center' },
  col: { width: '100%', maxWidth: 640, padding: '20px 24px 40px', display: 'flex', flexDirection: 'column', minHeight: '100dvh', boxSizing: 'border-box' },
  wordmark: { fontSize: 18 },
  label: { fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-2)', fontWeight: 500 },
  stage: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20, padding: '32px 0' },
  sentence: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 500, fontSize: 40, lineHeight: '44px', margin: 0, fontVariationSettings: '"SOFT" 100, "opsz" 144' },
  line: { fontSize: 17, color: 'var(--ink-2)', margin: 0 },
  field: { font: 'inherit', fontSize: 20, fontWeight: 700, color: 'var(--ink)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--rule)', padding: '10px 0', outline: 'none', width: '100%' },
  pill: { font: 'inherit', fontSize: 20, fontWeight: 700, minHeight: 64, borderRadius: 999, border: 'none', background: 'var(--amber)', color: 'var(--ink)', padding: '0 32px', cursor: 'pointer', width: '100%' },
  link: { font: 'inherit', fontSize: 17, color: 'var(--ink-2)', background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, minHeight: 44 },
  roster: { borderTop: '1px solid var(--rule)', paddingTop: 16 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--rule)', minHeight: 56 },
  name: { fontSize: 20, fontWeight: 700 },
};

export default function EnrollPage() {
  const token = param('token');
  const [phase, setPhase] = useState<Phase>('ready');
  const [name, setName] = useState('');
  const [last, setLast] = useState('');
  const [error, setError] = useState('');
  const [left, setLeft] = useState(SECONDS);
  const [roster, setRoster] = useState<Voice[]>([]);
  const [available, setAvailable] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const q = (extra: Record<string, string> = {}) => new URLSearchParams({ token, ...extra }).toString();

  useEffect(() => { document.title = 'Enroll voices · One at a time'; }, []);

  const loadRoster = useCallback(async () => {
    try {
      const r = await fetch(`/api/voice/roster?${new URLSearchParams({ token })}`);
      const j = await r.json() as { ok: boolean; available?: boolean; roster?: Voice[]; error?: string };
      if (!j.ok) { setError(j.error === 'bad token' ? 'This link is for another table. Open it again from the host phone.' : (j.error ?? 'Something went wrong.')); setPhase('error'); return; }
      setRoster(j.roster ?? []);
      setAvailable(j.available !== false);
    } catch { /* offline: keep what we have */ }
  }, [token]);
  useEffect(() => { void loadRoster(); }, [loadRoster]);

  const record = async () => {
    const who = name.trim();
    if (!who) { inputRef.current?.focus(); return; }
    setError('');
    setPhase('recording');
    setLeft(SECONDS);
    let peak = 0;
    try {
      const rec = await recordPcm16(SECONDS, (rms, ms) => {
        peak = Math.max(peak, rms);
        setLeft(Math.max(0, Math.ceil(SECONDS - ms / 1000)));
      });
      if (peak < QUIET_RMS) { setError("I couldn't hear anything. Hold the phone closer and try again."); setPhase('ready'); return; }
      setPhase('saving');
      const body = new Blob([rec.pcm.slice().buffer as ArrayBuffer], { type: 'application/octet-stream' });
      const r = await fetch(`/api/voice/enroll?${q({ name: who })}`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body });
      const j = await r.json() as { ok: boolean; roster?: Voice[]; error?: string };
      if (!j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setRoster(j.roster ?? []);
      setLast(who);
      setPhase('done');
    } catch (e) {
      const msg = (e as Error).message ?? '';
      setError(/Permission|NotAllowed/i.test(msg) || (e as Error).name === 'NotAllowedError'
        ? 'The microphone is blocked. Allow it in the browser and try again.'
        : `That didn't save. ${msg}`.trim());
      setPhase('ready');
    }
  };

  const next = () => { setName(''); setPhase('ready'); setTimeout(() => inputRef.current?.focus(), 0); };

  const remove = async (who: string) => {
    try {
      const r = await fetch(`/api/voice/enroll?${q({ name: who })}`, { method: 'DELETE' });
      const j = await r.json() as { ok: boolean; roster?: Voice[] };
      if (j.ok) setRoster(j.roster ?? []);
    } catch { /* ignore */ }
  };

  let stage: ReactNode;
  if (phase === 'error') {
    stage = <p style={S.sentence}>{error || 'This link is missing its table code.'}</p>;
  } else if (phase === 'recording') {
    stage = <>
      <span style={S.label}>Listening · {left} s</span>
      <p style={S.sentence} aria-live="polite">Keep talking, {name.trim()}.</p>
      <p style={S.line}>Say your name, then any sentence at all.</p>
    </>;
  } else if (phase === 'saving') {
    stage = <p style={{ ...S.sentence, color: 'var(--ink-2)' }} aria-live="polite">One moment.</p>;
  } else if (phase === 'done') {
    stage = <>
      <p style={S.sentence} aria-live="polite">Got you, {last}.</p>
      <p style={S.line}>The table will know your voice now.</p>
      <button type="button" style={S.pill} onClick={next} autoFocus>Next person</button>
      <button type="button" style={{ ...S.link, alignSelf: 'center' }} onClick={() => { setName(last); setPhase('ready'); }}>Record {last} again</button>
    </>;
  } else {
    stage = <>
      <p style={S.sentence}>Pass the phone. Say your name and one sentence.</p>
      <input
        ref={inputRef}
        style={S.field}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void record(); }}
        placeholder="Your name"
        aria-label="Your name"
        autoComplete="off"
        maxLength={40}
      />
      <button type="button" style={{ ...S.pill, opacity: name.trim() && available ? 1 : 0.55 }} onClick={() => void record()} disabled={!available}>
        That's me
      </button>
      {error && <p style={{ ...S.line, color: 'var(--ink)' }} role="alert">{error}</p>}
      {!available && <p style={S.line} role="alert">Voice names are off on this table.</p>}
    </>;
  }

  return (
    <div style={S.page}>
      <main style={S.col}>
        <div className="wordmark" style={S.wordmark}>One at a time</div>
        <div style={S.stage}>{stage}</div>
        {roster.length > 0 && (
          <section style={S.roster} aria-label="Voices on the table">
            <div style={{ ...S.label, marginBottom: 4 }}>On the table</div>
            {roster.map((v) => (
              <div key={v.name} style={S.row}>
                <span style={S.name}>{v.name}</span>
                <button type="button" style={S.link} onClick={() => void remove(v.name)} aria-label={`Remove ${v.name}`}>Remove</button>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
