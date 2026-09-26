import { useEffect, useState } from 'react';
import { hasSpeech, voicesFor } from '@/lib/clerkVoice';
import type { Session } from '../../../shared/types';
import { FONT_PX, type FontSize, type Prefs } from './prefs';
import { Modal } from './Modal';
import { JoinLink } from './JoinQr';
import { goToPhone } from './Listener';
import { listTables, locate, type TableRow } from '@/lib/notesDb';
import { cn } from '@/lib/utils';

interface Props {
  me: Session['me'];
  prefs: Prefs;
  listening: boolean;
  onMe: (name: string, aliases: string[]) => void;
  onPrefs: (p: Prefs) => void;
  onListening: (on: boolean) => void;
  onClose: () => void;
  participantCount?: number;
  /** Optional look-away section (camera, on-device). */
  away?: { enabled: boolean; sim: boolean; active: boolean; calibrating: boolean; setEnabled: (v: boolean) => void; calibrate: () => Promise<boolean> };
  captionsOnly?: boolean;
  notes?: { tableId: string | null; setPosition: (p: { lat: number; lng: number }) => void };
}

const label = 'oat-label mb-2 block';
const field = 'h-14 w-full rounded-xl border border-rule bg-cream px-4 text-[1.06rem] text-ink placeholder:text-ink-2';
const LANGS: { v: string; l: string }[] = [{ v: 'en', l: 'EN' }, { v: 'it', l: 'IT' }, { v: 'tr', l: 'TR' }];

export function SettingsDrawer({ me, prefs, onMe, onPrefs, onListening, onClose, participantCount = 0, away, captionsOnly, notes }: Props) {
  const [location, setLocation] = useState(prefs.location);
  const [pos, setPos] = useState<'idle' | 'busy' | 'ok' | 'no'>('idle');
  const [past, setPast] = useState<TableRow[] | null>(null);
  useEffect(() => { let dead = false; listTables().then((t) => { if (!dead) setPast(t); }).catch(() => { if (!dead) setPast([]); }); return () => { dead = true; }; }, []);
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
  const [roomToken, setRoomToken] = useState('');
  useEffect(() => {
    let dead = false;
    fetch('/api/room').then((r) => (r.ok ? r.json() : null)).then((j: { token?: string } | null) => { if (!dead && j?.token) setRoomToken(j.token); }).catch(() => {});
    return () => { dead = true; };
  }, []);
  return (
    <Modal title="Settings" onClose={() => { save(); onClose(); }} variant="sheet">
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
          <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Text size">
            {(Object.keys(FONT_PX) as FontSize[]).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={prefs.font === f} onClick={() => onPrefs({ ...prefs, font: f })}
                className={cn('h-14 cursor-pointer rounded-full font-bold transition-colors duration-150', prefs.font === f ? 'bg-ink text-cream' : 'text-ink-2 hover:text-ink')}>{f}</button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className={label}>Language</legend>
          <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Language">
            {LANGS.map(({ v, l }) => (
              <button key={v} type="button" role="radio" aria-checked={lang === v}
                onClick={async () => {
                  if (lang === v) return;
                  setLang(v);
                  try { await fetch('/api/room/lang', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: v }) }); } catch { /* offline */ }
                  // New language applies to new audio sockets: bounce listening so the host reconnects.
                  onListening(false); window.setTimeout(() => onListening(true), 400);
                }}
                className={cn('h-14 cursor-pointer rounded-full font-bold transition-colors duration-150', lang === v ? 'bg-ink text-cream' : 'text-ink-2 hover:text-ink')}>{l}</button>
            ))}
          </div>
        </fieldset>

        <div className="divide-y divide-rule border-y border-rule">
          <Switch label="Show captions" hint="Every line, in a list under the sentence." on={prefs.captions} onChange={(v) => onPrefs({ ...prefs, captions: v })} />
          <Switch label="The clerk speaks for me" hint="Your lines are read aloud on everyone’s phone, and phones say “one at a time” when people overlap." on={prefs.clerkSpeaks} onChange={(v) => onPrefs({ ...prefs, clerkSpeaks: v })} />
          {prefs.clerkSpeaks && hasSpeech() && (
            <label className="block pb-4">
              <span className={label}>Clerk voice</span>
              <select value={prefs.clerkVoice} onChange={(e) => onPrefs({ ...prefs, clerkVoice: e.target.value })} className={field} aria-label="Clerk voice">
                <option value="">Automatic{voices[0] ? ` (${voices[0].name})` : ''}</option>
                {voices.map((v) => <option key={v.voiceURI} value={v.name}>{v.name} · {v.lang}</option>)}
              </select>
              <span className="mt-2 block text-[0.94rem] text-ink-2">Phones use this voice if they have it. Phones that joined earlier rescan to hear “one at a time”.</span>
            </label>
          )}
          {away && (
            <div>
              <Switch label="Notice when I look away" hint={away.sim ? 'Simulator on: press A to toggle away.' : 'Camera, on this phone only. Nothing is stored or sent.'} on={away.enabled} onChange={away.setEnabled} />
              {away.enabled && (
                <button type="button" disabled={away.sim || !away.active || away.calibrating} onClick={() => void away.calibrate()}
                  className="mb-3 min-h-14 w-full cursor-pointer rounded-full bg-card-2 px-5 text-left font-bold text-ink disabled:cursor-default disabled:opacity-50">
                  {away.calibrating ? 'Hold still…' : 'Calibrate: look at the table, then tap'}
                </button>
              )}
            </div>
          )}
        </div>

        <section aria-labelledby="oat-where" className="border-b border-rule py-4">
          <label className="block">
            <span id="oat-where" className={label}>Where is this table?</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} onBlur={() => onPrefs({ ...prefs, location: location.trim() })}
              placeholder="Nonna’s kitchen" className={field} />
          </label>
          <button type="button" disabled={pos === 'busy'} onClick={async () => {
            setPos('busy'); const p = await locate(); if (p) { notes?.setPosition(p); setPos('ok'); } else setPos('no');
          }} className="mt-2 min-h-12 cursor-pointer text-[1rem] text-ink-2 underline-offset-4 hover:underline disabled:cursor-default">
            {pos === 'busy' ? 'Finding your position…' : pos === 'ok' ? 'Position saved with this table' : pos === 'no' ? 'No position (allow location and try again)' : 'Use my position'}
          </button>
          <p className="mt-2 text-[0.94rem] leading-snug text-ink-2">The notes the clerk takes here (plans, asks, what you missed) are kept with this place and date. Audio is never stored.</p>
          {past && past.length > 0 && (
            <ul className="mt-3 divide-y divide-rule border-t border-rule" aria-label="Past tables">
              {past.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-baseline justify-between gap-3 py-2 text-[1rem]">
                  <span className="min-w-0 truncate font-bold text-ink">{t.location || 'Somewhere'}{t.me ? ` · ${t.me}` : ''}</span>
                  <span className="oat-label shrink-0">{new Date(t.startedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {t.notes ?? 0} notes</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <a href={`/enroll.html${roomToken ? `?token=${encodeURIComponent(roomToken)}` : ''}`} target="_blank" rel="noreferrer"
          className="flex min-h-16 items-center justify-between gap-4 border-b border-rule py-3 text-left">
          <span className="min-w-0">
            <span className="block text-[1.06rem] font-bold text-ink">Teach the table your voices</span>
            <span className="block text-[0.94rem] leading-snug text-ink-2">One phone for everyone: each person talks 5 s, lines get their name by voice.</span>
          </span>
          <span aria-hidden className="text-ink-2">›</span>
        </a>
        <button type="button" onClick={() => void goToPhone()} className="flex w-full cursor-pointer items-center justify-between border-t border-rule py-4 text-left">
          <span>
            <span className="block text-[1.06rem] font-bold text-ink">Use this phone as a speaker instead</span>
            <span className="block text-[0.94rem] leading-snug text-ink-2">Goes to the lamp page. Someone else reads.</span>
          </span>
          <span aria-hidden className="text-ink-2">›</span>
        </button>
        <JoinLink hostName={me.name} clerkSpeaks={prefs.clerkSpeaks} clerkVoice={prefs.clerkVoice} count={participantCount} />
        {captionsOnly && <p className="oat-label">Browser captions only · speakers not told apart</p>}
        <p className="oat-label">Nothing is stored · audio stays in memory 15 min</p>
      </div>
    </Modal>
  );
}

function Switch({ label: text, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-4 py-3 text-left">
      <span className="min-w-0">
        <span className="block text-[1.06rem] font-bold text-ink">{text}</span>
        {hint && <span className="block text-[0.94rem] leading-snug text-ink-2">{hint}</span>}
      </span>
      <span aria-hidden className={cn('relative h-8 w-13 shrink-0 rounded-full transition-colors duration-200', on ? 'bg-ink' : 'bg-rule')}>
        <span className={cn('absolute top-1 size-6 rounded-full bg-cream transition-[left] duration-200', on ? 'left-6' : 'left-1')} />
      </span>
    </button>
  );
}
