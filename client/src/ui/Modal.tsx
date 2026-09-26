import type { ReactNode } from 'react';
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
 * Flat cream sheet, a title in Fraunces italic, a plain "Done" text button. Mounted = open.
 */
export function Modal({ title, onClose, children, variant = 'center', dismissable = true }: Props) {
  const onOpenChange = (open: boolean) => { if (!open && dismissable) onClose(); };
  const block = dismissable ? undefined : (e: Event) => e.preventDefault();
  const onOpenAutoFocus = (e: Event) => {
    const root = e.currentTarget as HTMLElement;
    const first = root.querySelector<HTMLElement>('[data-modal-body] :is(input, select, textarea, button, [href]):not([disabled])');
    if (first) { e.preventDefault(); first.focus(); }
  };
  const guards = { onOpenAutoFocus, onEscapeKeyDown: block, onPointerDownOutside: block, onInteractOutside: block, 'aria-describedby': undefined };

  const header = (Title: typeof DialogTitle) => (
    <div className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-rule px-5">
      <Title className="font-display-italic text-[1.5rem] leading-tight text-ink">{title}</Title>
      {dismissable && (
        <DialogPrimitive.Close className="-mr-2 h-14 min-w-14 cursor-pointer rounded-xl px-3 font-bold text-ink underline-offset-4 hover:underline">
          Done
        </DialogPrimitive.Close>
      )}
    </div>
  );
  const body = <div data-modal-body className="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-[1rem]">{children}</div>;

  if (variant === 'center') {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} {...guards}
          className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-xl border-0 bg-bg p-0 text-ink shadow-none sm:max-w-md">
          {header(DialogTitle)}
          {body}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side={variant === 'sheet' ? 'bottom' : 'right'} showCloseButton={false} {...guards}
        className={cn('flex-col gap-0 border-0 bg-bg p-0 text-ink shadow-none',
          variant === 'sheet' ? 'mx-auto max-h-[85dvh] w-full max-w-[640px] rounded-t-xl' : 'h-full w-full max-w-md sm:max-w-md')}>
        {header(SheetTitle)}
        {body}
      </SheetContent>
    </Sheet>
  );
}
