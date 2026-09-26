import { useState } from 'react';
import { Modal } from './Modal';

/** One-step first run: name is what makes "asked you" detection work. */
export function Onboarding({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <Modal title="I Missed That" onClose={() => {}} dismissable={false}>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onDone(name.trim()); }} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-[1.2rem] font-semibold">What's your name?</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" placeholder="Your first name"
            className="w-full rounded-xl border border-line bg-card-2 px-3 py-3 text-[1.2rem]" />
        </label>
        <p className="text-[1rem] text-muted">We'll tell you when someone asks you something. Put the phone on the table, screen up.</p>
        <button type="submit" disabled={!name.trim()}
          className="w-full rounded-xl bg-accent py-3 text-[1.1rem] font-semibold text-black disabled:opacity-40">Start</button>
      </form>
    </Modal>
  );
}
