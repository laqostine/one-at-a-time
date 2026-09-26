import { useState } from 'react';
import type { Speaker } from '../../../shared/types';
import { Modal } from './Modal';
import { Button } from '@/components/ui/button';

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
          <span className="mb-1.5 flex items-center gap-2 card-label">
            <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: speaker.color }} /> Name
          </span>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={into !== ''} placeholder="e.g. Alex"
            className="h-12 w-full rounded-xl border border-input bg-card-2 px-3 text-[1.1rem] transition-colors duration-150 focus:border-accent disabled:opacity-40" />
        </label>
        {others.length > 0 && (
          <label className="block">
            <span className="mb-1.5 block card-label">Or: same person as…</span>
            <select value={into} onChange={(e) => setInto(e.target.value)}
              className="h-12 w-full rounded-xl border border-input bg-card-2 px-3 text-[1.1rem]">
              <option value="">— different person —</option>
              {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} className="text-[1rem]">Cancel</Button>
          <Button type="submit" className="px-6 text-[1rem]">
            {into !== '' ? 'Merge' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
