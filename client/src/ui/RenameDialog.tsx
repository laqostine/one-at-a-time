import { useState } from 'react';
import type { Speaker } from '../../../shared/types';
import { Modal } from './Modal';

interface Props {
  speaker: Speaker;
  current: string;
  others: { id: number; name: string }[];
  onRename: (name: string) => void;
  onMerge: (into: number) => void;
  onClose: () => void;
}

export function RenameDialog({ speaker, current, others, onRename, onMerge, onClose }: Props) {
  const [name, setName] = useState(speaker.name ?? '');
  const [into, setInto] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (into !== '') onMerge(Number(into)); else onRename(name);
    onClose();
  };
  return (
    <Modal title={`Who is ${current}?`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1 flex items-center gap-2 text-[0.9rem] text-muted">
            <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: speaker.color }} /> Name
          </span>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={into !== ''} placeholder="e.g. Alex"
            className="w-full rounded-xl border border-line bg-card-2 px-3 py-2.5 text-[1.1rem] disabled:opacity-40" />
        </label>
        {others.length > 0 && (
          <label className="block">
            <span className="mb-1 block text-[0.9rem] text-muted">Or: same person as…</span>
            <select value={into} onChange={(e) => setInto(e.target.value)}
              className="w-full rounded-xl border border-line bg-card-2 px-3 py-2.5 text-[1.1rem]">
              <option value="">— different person —</option>
              {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-muted hover:text-fg">Cancel</button>
          <button type="submit" className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-black">
            {into !== '' ? 'Merge' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
