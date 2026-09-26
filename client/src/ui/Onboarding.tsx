import { useState } from 'react';
import { Modal } from './Modal';
import { PresenceAuto } from './PresenceAuto';

/** One-step first run: name is what makes "asked you" detection work. */
export function Onboarding({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <Modal title="I Missed That" onClose={() => {}} dismissable={false}>
      <div className="mb-3 flex justify-center">
        <PresenceAuto size={160} state="listening" level={0} />
      </div>
      <p className="text-center font-display-italic text-[1.6rem] leading-tight">We tell you what you missed.</p>
      <p className="mb-5 text-center text-[1rem] text-muted">Sunday lunch, Thursday standup: any table.</p>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onDone(name.trim()); }} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-[1.15rem] font-semibold">What's your name?</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" placeholder="Your first name"
            className="h-13 w-full rounded-xl border border-input bg-card-2 px-3 text-[1.2rem] transition-colors duration-150 focus:border-accent" />
        </label>
        <p className="text-[1rem] text-muted">So we can tell you when someone asks you something. Put the phone on the table, screen up.</p>
        <button type="submit" disabled={!name.trim()}
          className="h-14 w-full cursor-pointer rounded-xl bg-accent text-[1.15rem] font-bold text-accent-fg transition-[filter] duration-150 hover:brightness-110 disabled:cursor-default disabled:opacity-40">Start</button>
      </form>
    </Modal>
  );
}
