import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  variant?: 'center' | 'sheet' | 'drawer';
  dismissable?: boolean;
}

/**
 * Accessible dialog on shadcn/ui (Radix): focus trapped and restored, Esc + outside click close.
 * `center` = Dialog, `sheet` = bottom Sheet, `drawer` = right Sheet. Mounted = open.
 */
export function Modal({ title, onClose, children, variant = 'center', dismissable = true }: Props) {
  const onOpenChange = (open: boolean) => { if (!open && dismissable) onClose(); };
  const block = dismissable ? undefined : (e: Event) => e.preventDefault();
  // Focus the first field/action in the body rather than the header's close button.
  const onOpenAutoFocus = (e: Event) => {
    const root = e.currentTarget as HTMLElement;
    const first = root.querySelector<HTMLElement>('[data-modal-body] :is(input, select, textarea, button, [href]):not([disabled])');
    if (first) { e.preventDefault(); first.focus(); }
  };
  const guards = { onOpenAutoFocus, onEscapeKeyDown: block, onPointerDownOutside: block, onInteractOutside: block, 'aria-describedby': undefined };

  const header = (Title: typeof DialogTitle) => (
    <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
      <Title className="text-[1.15rem] leading-tight font-semibold text-fg">{title}</Title>
      {dismissable && (
        <DialogPrimitive.Close aria-label="Close"
          className="-mr-2 flex size-11 cursor-pointer items-center justify-center rounded-xl text-muted transition-colors duration-150 hover:bg-card-2 hover:text-fg">
          <X size={22} aria-hidden />
        </DialogPrimitive.Close>
      )}
    </div>
  );
  const body = <div data-modal-body className="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-[1rem]">{children}</div>;

  if (variant === 'center') {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} {...guards}
          className="flex max-h-[90dvh] w-full max-w-md flex-col gap-0 overflow-hidden linen rounded-[8px_12px_10px_6px] border-0 p-0 shadow-[var(--shadow-sheet)] sm:max-w-md">
          {header(DialogTitle)}
          {body}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side={variant === 'sheet' ? 'bottom' : 'right'} showCloseButton={false} {...guards}
        className={cn('linen flex-col gap-0 border-0 p-0',
          variant === 'sheet' ? 'mx-auto max-h-[80dvh] w-full max-w-3xl rounded-t-2xl border-x' : 'h-full w-full max-w-sm sm:max-w-sm')}>
        {header(SheetTitle)}
        {body}
      </SheetContent>
    </Sheet>
  );
}
