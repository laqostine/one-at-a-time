import { useState } from 'react';
import type { Session } from '../../../shared/types';
import { FONT_PX, type FontSize, type Prefs } from './prefs';
import { Modal } from './Modal';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

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
      <div className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block card-label">My name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={save}
            className="h-12 w-full rounded-xl border border-input bg-card-2 px-3 text-[1.1rem] transition-colors duration-150 placeholder:text-muted/80 focus:border-accent" />
        </label>
        <label className="block">
          <span className="mb-1.5 block card-label">Also called (comma separated)</span>
          <input value={aliases} onChange={(e) => setAliases(e.target.value)} onBlur={save} placeholder="nickname, surname"
            className="h-12 w-full rounded-xl border border-input bg-card-2 px-3 text-[1.1rem] transition-colors duration-150 placeholder:text-muted/80 focus:border-accent" />
        </label>
        <fieldset>
          <legend className="mb-2 card-label">Text size</legend>
          <div className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-card-2 p-1" role="radiogroup" aria-label="Text size">
            {(Object.keys(FONT_PX) as FontSize[]).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={prefs.font === f} onClick={() => onPrefs({ ...prefs, font: f })}
                className={`h-11 cursor-pointer rounded-lg font-semibold transition-colors duration-150 ${prefs.font === f ? 'bg-accent text-accent-fg' : 'text-muted hover:bg-card hover:text-fg'}`}>{f}</button>
            ))}
          </div>
        </fieldset>
        <Separator />
        <Toggle label="High contrast" on={prefs.contrast} onChange={(v) => onPrefs({ ...prefs, contrast: v })} />
        <Toggle label="Listening" on={listening} onChange={onListening} />
        {away && (
          <div className="space-y-2">
            <Toggle label="Notice when I look away (camera, on-device)" on={away.enabled} onChange={away.setEnabled} />
            {away.enabled && (
              <button type="button" disabled={away.sim || !away.active || away.calibrating} onClick={() => void away.calibrate()}
                className="min-h-12 w-full cursor-pointer rounded-xl border border-input bg-card-2 px-3 py-2.5 text-[1rem] font-semibold transition-colors duration-150 hover:bg-card disabled:cursor-default disabled:opacity-50">
                {away.calibrating ? 'Hold still, looking at the table…' : 'Calibrate: look at the table and press'}
              </button>
            )}
            <p className="text-meta">
              {away.sim ? 'Simulator on (?away=1): press A to toggle away.' : 'Video is analysed on this device only. No frames are stored or sent; only "away / not away" is kept.'}
            </p>
          </div>
        )}
        <Separator />
        <p className="text-meta">Audio stays in memory for the last 15 minutes only. Nothing is stored after you close this tab.</p>
      </div>
    </Modal>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  const id = `imt-sw-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="flex min-h-12 items-center justify-between gap-4">
      <label htmlFor={id} className="cursor-pointer text-[1.05rem]">{label}</label>
      <Switch id={id} checked={on} onCheckedChange={onChange} />
    </div>
  );
}
