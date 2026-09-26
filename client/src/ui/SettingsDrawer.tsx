import { useState } from 'react';
import type { Session } from '../../../shared/types';
import { FONT_PX, type FontSize, type Prefs } from './prefs';
import { Modal } from './Modal';

interface Props {
  me: Session['me'];
  prefs: Prefs;
  listening: boolean;
  onMe: (name: string, aliases: string[]) => void;
  onPrefs: (p: Prefs) => void;
  onListening: (on: boolean) => void;
  onClose: () => void;
  /** Optional look-away section (camera, on-device). */
  away?: { enabled: boolean; sim: boolean; active: boolean; calibrating: boolean; setEnabled: (v: boolean) => void; calibrate: () => Promise<boolean> };
}

export function SettingsDrawer({ me, prefs, listening, onMe, onPrefs, onListening, onClose, away }: Props) {
  const [name, setName] = useState(me.name);
  const [aliases, setAliases] = useState(me.aliases.join(', '));
  const save = () => onMe(name, aliases.split(',').map((a) => a.trim()).filter(Boolean));
  return (
    <Modal title="Settings" onClose={() => { save(); onClose(); }} variant="drawer">
      <div className="space-y-6">
        <label className="block">
          <span className="mb-1 block text-[0.9rem] text-muted">My name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={save}
            className="w-full rounded-xl border border-line bg-card-2 px-3 py-2.5 text-[1.1rem]" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.9rem] text-muted">Also called (comma separated)</span>
          <input value={aliases} onChange={(e) => setAliases(e.target.value)} onBlur={save} placeholder="nickname, surname"
            className="w-full rounded-xl border border-line bg-card-2 px-3 py-2.5 text-[1.1rem]" />
        </label>
        <fieldset>
          <legend className="mb-2 text-[0.9rem] text-muted">Text size</legend>
          <div className="grid grid-cols-4 gap-2" role="radiogroup">
            {(Object.keys(FONT_PX) as FontSize[]).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={prefs.font === f} onClick={() => onPrefs({ ...prefs, font: f })}
                className={`rounded-xl border py-2.5 font-semibold ${prefs.font === f ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-card-2'}`}>{f}</button>
            ))}
          </div>
        </fieldset>
        <Toggle label="High contrast" on={prefs.contrast} onChange={(v) => onPrefs({ ...prefs, contrast: v })} />
        <Toggle label="Listening" on={listening} onChange={onListening} />
        {away && (
          <div className="space-y-2">
            <Toggle label="Notice when I look away (camera, on-device)" on={away.enabled} onChange={away.setEnabled} />
            {away.enabled && (
              <button type="button" disabled={away.sim || !away.active || away.calibrating} onClick={() => void away.calibrate()}
                className="w-full rounded-xl border border-line bg-card-2 px-3 py-3 text-[1.05rem] disabled:opacity-50">
                {away.calibrating ? 'Hold still, looking at the table…' : 'Calibrate: look at the table and press'}
              </button>
            )}
            <p className="text-[0.85rem] text-muted">
              {away.sim ? 'Simulator on (?away=1): press A to toggle away.' : 'Video is analysed on this device only. No frames are stored or sent; only "away / not away" is kept.'}
            </p>
          </div>
        )}
        <p className="text-[0.85rem] text-muted">Audio stays in memory for the last 15 minutes only. Nothing is stored after you close this tab.</p>
      </div>
    </Modal>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between rounded-xl border border-line bg-card-2 px-3 py-3 text-[1.05rem]">
      {label}
      <span aria-hidden className={`relative h-7 w-12 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-line'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}
