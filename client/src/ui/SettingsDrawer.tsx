import { useEffect, useState } from 'react';
import { hasSpeech, voicesFor } from '@/lib/clerkVoice';
import type { Session } from '../../../shared/types';
import { FONT_PX, type FontSize, type Prefs } from './prefs';
import { Modal } from './Modal';
import { cn } from '@/lib/utils';

interface Props {
  me: Session['me'];
  prefs: Prefs;
  listening: boolean;
  onMe: (name: string, aliases: string[]) => void;
  onPrefs: (p: Prefs) => void;
  onListening: (on: boolean) => void;
  onClose: () => void;
  /** Opens the plain "Add phones" QR modal. */
  onAddPhones?: () => void;
  participantCount?: number;
  /** Optional look-away section (camera, on-device). */
  away?: { enabled: boolean; sim: boolean; active: boolean; calibrating: boolean; setEnabled: (v: boolean) => void; calibrate: () => Promise<boolean> };
  captionsOnly?: boolean;
}

const label = 'mb-2 block font-mono text-[0.72rem] font-bold tracking-[0.12em] text-muted uppercase';
const field = 'h-14 w-full rounded-xl border border-line-strong bg-card px-4 text-[1.05rem] text-ink transition-colors duration-150 placeholder:text-muted focus:border-ink';

export function SettingsDrawer({ me, prefs, listening, onMe, onPrefs, onListening, onClose, onAddPhones, participantCount = 0, away, captionsOnly }: Props) {
  const [name, setName] = useState(me.name);
  const [aliases, setAliases] = useState(me.aliases.join(', '));
  const save = () => onMe(name, aliases.split(',').map((a) => a.trim()).filter(Boolean));
  const [lang, setLang] = useState('en');
  useEffect(() => {
    let dead = false;
    fetch('/api/room/lang').then((r) => (r.ok ? r.json() : null)).then((j: { lang?: string } | null) => { if (!dead && j?.lang) setLang(j.lang); }).catch(() => {});
    return () => { dead = true; };
  }, []);
  // speechSynthesis voices load asynchronously on most browsers.
  const [, setVoicesReady] = useState(0);
  useEffect(() => {
    if (!hasSpeech()) return;
    const on = () => setVoicesReady((n) => n + 1);
    window.speechSynthesis.addEventListener?.('voiceschanged', on);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', on);
  }, []);
  const voices = voicesFor(lang);
  return (
    <Modal title="Settings" onClose={() => { save(); onClose(); }} variant="drawer">
      <div className="space-y-6">
        <label className="block">
          <span className={label}>My name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={save} className={field} />
        </label>
        <label className="block">
          <span className={label}>Also called</span>
          <input value={aliases} onChange={(e) => setAliases(e.target.value)} onBlur={save} placeholder="nickname, surname" className={field} />
        </label>
        <fieldset>
          <legend className={label}>Text size</legend>
          <div className="grid grid-cols-4 gap-1 rounded-xl border border-line p-1" role="radiogroup" aria-label="Text size">
            {(Object.keys(FONT_PX) as FontSize[]).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={prefs.font === f} onClick={() => onPrefs({ ...prefs, font: f })}
                className={cn('h-12 cursor-pointer rounded-lg font-bold transition-colors duration-150', prefs.font === f ? 'bg-ink text-cream' : 'text-muted hover:text-ink')}>{f}</button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className={label}>Language</span>
          <select value={lang} aria-label="Language"
            onChange={async (e) => {
              const lang = e.target.value;
              setLang(lang);
              try { await fetch('/api/room/lang', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang }) }); } catch { /* offline */ }
              // New language applies to new audio sockets: bounce listening so the host reconnects.
              onListening(false); window.setTimeout(() => onListening(true), 400);
            }}
            className={field}>
            <option value="en">English</option>
            <option value="it">Italiano</option>
            <option value="tr">Türkçe</option>
            <option value="multi">Mixed / auto</option>
          </select>
        </label>

        <div className="divide-y divide-line border-y border-line">
          <Switch label="Show captions" hint="Every line, in a list under the sentence." on={prefs.captions} onChange={(v) => onPrefs({ ...prefs, captions: v })} />
          <Switch label="Also say it aloud" hint="What you type always goes to every phone first." on={prefs.voice} onChange={(v) => onPrefs({ ...prefs, voice: v })} />
          <Switch label="The clerk speaks for me" hint="Your lines are read aloud on everyone’s phone, and phones say “one at a time” when people overlap." on={prefs.clerkSpeaks} onChange={(v) => onPrefs({ ...prefs, clerkSpeaks: v })} />
          {prefs.clerkSpeaks && hasSpeech() && (
            <label className="block pb-4">
              <span className={label}>Clerk voice</span>
              <select value={prefs.clerkVoice} onChange={(e) => onPrefs({ ...prefs, clerkVoice: e.target.value })} className={field} aria-label="Clerk voice">
                <option value="">Automatic{voices[0] ? ` (${voices[0].name})` : ''}</option>
                {voices.map((v) => <option key={v.voiceURI} value={v.name}>{v.name} · {v.lang}</option>)}
              </select>
              <span className="mt-2 block text-[0.9rem] text-muted">Phones use this voice if they have it. Re-share the QR after changing it.</span>
            </label>
          )}
          {away && (
            <div>
              <Switch label="Notice when I look away" hint={away.sim ? 'Simulator on: press A to toggle away.' : 'Camera, on this phone only. Nothing is stored or sent.'} on={away.enabled} onChange={away.setEnabled} />
              {away.enabled && (
                <button type="button" disabled={away.sim || !away.active || away.calibrating} onClick={() => void away.calibrate()}
                  className="mb-3 min-h-14 w-full cursor-pointer rounded-xl border border-line-strong px-4 text-left font-bold text-ink disabled:cursor-default disabled:opacity-50">
                  {away.calibrating ? 'Hold still…' : 'Calibrate: look at the table, then tap'}
                </button>
              )}
            </div>
          )}
          <Switch label="Listening" on={listening} onChange={onListening} />
          <Switch label="High contrast" on={prefs.contrast} onChange={(v) => onPrefs({ ...prefs, contrast: v })} />
        </div>

        {onAddPhones && (
          <button type="button" onClick={onAddPhones}
            className="flex min-h-16 w-full cursor-pointer items-center justify-between rounded-xl border border-line-strong px-4 text-left">
            <span>
              <span className="block text-[1.05rem] font-bold text-ink">Add phones</span>
              <span className="block text-[0.9rem] text-muted">A QR code for everyone at the table</span>
            </span>
            <span className="font-mono text-[0.85rem] font-bold text-ink tabular-nums">{participantCount} on</span>
          </button>
        )}
        {captionsOnly && <p className="text-[0.9rem] text-warn">Browser captions only: speakers are not told apart.</p>}
        <p className="text-[0.9rem] text-muted">Audio stays in memory for 15 minutes. Nothing is stored after you close this tab.</p>
      </div>
    </Modal>
  );
}

function Switch({ label: text, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-4 py-3 text-left">
      <span className="min-w-0">
        <span className="block text-[1.05rem] font-bold text-ink">{text}</span>
        {hint && <span className="block text-[0.9rem] leading-snug text-muted">{hint}</span>}
      </span>
      <span aria-hidden className={cn('relative h-8 w-13 shrink-0 rounded-full border-2 transition-colors duration-160', on ? 'border-ink bg-ink' : 'border-line-strong bg-transparent')}>
        <span className={cn('absolute top-1/2 size-5 -translate-y-1/2 rounded-full transition-[left,background-color] duration-160', on ? 'left-[1.45rem] bg-cream' : 'left-1 bg-muted')} />
      </span>
    </button>
  );
}
