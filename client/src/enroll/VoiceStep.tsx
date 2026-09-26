// Joining step: "Teach the table your voice". One headline, one line, one amber pill.
// Used by the speaker phone (join.html) and the listener's onboarding. Records 5 s with record.ts (its own
// getUserMedia, fully stopped before onDone fires), POSTs it to /api/voice/enroll, then hands back.
import { useEffect, useRef, useState } from 'react';
import { recordPcm16 } from './record';

const SECONDS = 8;
const QUIET_RMS = 0.01;
const GOT_MS = 1_200;
const FAIL_MS = 1_800;

interface Voice { name: string; samples: number }

/** True when the step should be skipped: this name already has a sample, or the table has no voice model. */
export async function voiceAlreadyKnown(token: string, name: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/voice/roster?${new URLSearchParams({ token })}`);
    if (!r.ok) return false;
    const j = await r.json() as { ok: boolean; available?: boolean; roster?: Voice[] };
    if (!j.ok) return false;
    if (j.available === false) return true;
    const key = name.trim().toLowerCase();
    return (j.roster ?? []).some((v) => v.name.trim().toLowerCase() === key && v.samples >= 1);
  } catch { return false; }
}

type Step = 'ask' | 'rec' | 'saving' | 'got' | 'failed';

export function VoiceStep({ name, token, onDone, onGesture, onRename }: {
  name: string;
  /** Optional: the person can correct the name this voice is saved under (listener page). */
  onRename?: (name: string) => void;
  token: string;
  /** Called after the recorder's stream is stopped and the result line has been shown. */
  onDone: () => void;
  /** Runs synchronously inside the tap (unlock audio etc.). */
  onGesture?: () => void;
}) {
  const [step, setStep] = useState<Step>('ask');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [left, setLeft] = useState(SECONDS);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState('');
  const quietTries = useRef(0);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const finish = (s: Step, ms: number) => {
    setStep(s);
    timer.current = window.setTimeout(onDone, ms);
  };

  // Must stay a plain click handler: recordPcm16 calls getUserMedia first thing (iOS needs the gesture).
  const tap = () => {
    if (step !== 'ask') return;
    onGesture?.();
    setNote('');
    setStep('rec');
    setLeft(SECONDS);
    setProgress(0);
    let peak = 0;
    const rec = recordPcm16(SECONDS, (rms, ms) => {
      peak = Math.max(peak, rms);
      setLeft(Math.max(1, Math.ceil(SECONDS - ms / 1000)));
      setProgress(Math.min(1, ms / (SECONDS * 1000)));
    });
    void (async () => {
      try {
        const { pcm } = await rec; // resolves only after the mic tracks are stopped
        setProgress(1);
        if (peak < QUIET_RMS) {
          quietTries.current += 1;
          if (quietTries.current < 2) { setNote('I couldn’t hear you. Once more, a little closer.'); setStep('ask'); setProgress(0); return; }
          throw new Error('quiet');
        }
        setStep('saving');
        const body = new Blob([pcm.slice().buffer as ArrayBuffer], { type: 'application/octet-stream' });
        const r = await fetch(`/api/voice/enroll?${new URLSearchParams({ token, name })}`, {
          method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body,
        });
        const j = await r.json().catch(() => ({ ok: false })) as { ok: boolean };
        if (!r.ok || !j.ok) throw new Error(`HTTP ${r.status}`);
        finish('got', GOT_MS);
      } catch {
        finish('failed', FAIL_MS);
      }
    })();
  };

  const busy = step !== 'ask';
  return (
    <div className="oat-in my-auto flex flex-col gap-5 py-10" data-testid="voice-step">
      {step === 'got' ? (
        <p className="font-display-italic text-[2.353rem] leading-[1.1] text-ink" aria-live="polite">Got you, {name}.</p>
      ) : (
        <>
          <h1 className="font-display-italic text-[2.353rem] leading-[1.1] text-ink">Teach the table your voice</h1>
          <p className="text-[20px] leading-snug text-ink-2">Say your name, then keep talking until the bar fills. Two or three sentences.</p>
          {editing ? (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = draft.trim(); if (n) { onRename?.(n); setEditing(false); } }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus aria-label="Your name" autoComplete="given-name"
                className="h-14 min-w-0 flex-1 rounded-xl border border-rule bg-cream px-4 text-[1.176rem] text-ink" />
              <button type="submit" disabled={!draft.trim()} className="h-14 shrink-0 cursor-pointer rounded-full bg-ink px-5 font-bold text-cream disabled:opacity-40">Save</button>
            </form>
          ) : (
            <p className="text-[1.06rem] text-ink-2" data-testid="voice-whose">
              Saving this voice as <span className="font-bold text-ink">{name}</span>.
              {onRename && <> <button type="button" onClick={() => { setDraft(name); setEditing(true); }} className="cursor-pointer underline underline-offset-4">Not you? Change</button></>}
            </p>
          )}
        </>
      )}
      {step !== 'got' && (
        <div>
          <button type="button" onClick={tap} disabled={busy} aria-live="polite"
            className="h-16 w-full cursor-pointer rounded-full bg-amber text-[20px] font-bold text-ink disabled:cursor-default">
            {step === 'rec' ? <span className="font-mono text-[18px] font-medium tracking-[.08em]">Listening · {left}</span>
              : step === 'saving' || step === 'failed' ? <span className="font-mono text-[18px] font-medium tracking-[.08em]">Listening · done</span>
              : 'That’s me'}
          </button>
          <div aria-hidden className="mx-8 mt-3 h-[3px] bg-transparent">
            <div className="h-full bg-amber transition-[width] duration-100 ease-linear" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}
      {step === 'failed' && <p className="text-[20px] leading-snug text-ink" role="alert">Couldn’t save your voice, joining anyway.</p>}
      {step === 'ask' && note && <p className="text-[20px] leading-snug text-ink" role="alert">{note}</p>}
    </div>
  );
}
