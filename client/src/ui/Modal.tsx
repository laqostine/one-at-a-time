import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  variant?: 'center' | 'sheet' | 'drawer';
  dismissable?: boolean;
}

/** Minimal accessible dialog: Esc closes, focus moves in and is restored, Tab is trapped. */
export function Modal({ title, onClose, children, variant = 'center', dismissable = true }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close]), [href]');
    (first ?? panel.current)?.focus();
    return () => prev?.focus?.();
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && dismissable) { e.stopPropagation(); onClose(); }
    if (e.key !== 'Tab' || !panel.current) return;
    const f = [...panel.current.querySelectorAll<HTMLElement>('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])')].filter((el) => !el.hasAttribute('disabled'));
    if (!f.length) return;
    const [a, z] = [f[0], f[f.length - 1]];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  };

  const pos = variant === 'sheet'
    ? 'items-end justify-center'
    : variant === 'drawer' ? 'items-stretch justify-end' : 'items-center justify-center p-4';
  const shape = variant === 'sheet'
    ? 'w-full max-w-2xl max-h-[80dvh] rounded-t-2xl'
    : variant === 'drawer' ? 'w-full max-w-sm h-full' : 'w-full max-w-md rounded-2xl max-h-[90dvh]';

  return (
    <div className={`fixed inset-0 z-50 flex bg-black/60 ${pos}`} onKeyDown={onKey}
      onMouseDown={(e) => { if (dismissable && e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className={`flex flex-col bg-card border border-line text-fg shadow-2xl ${shape}`}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          {dismissable && (
            <button data-close type="button" onClick={onClose} aria-label="Close"
              className="rounded-lg p-2 text-muted hover:bg-card-2 hover:text-fg">
              <X size={22} aria-hidden />
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
