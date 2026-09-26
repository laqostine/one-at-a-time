import { cn } from '@/lib/utils';

/** The calligraphic wordmark (public/wordmark.png, keyed from design/assets/wordmark-script.png). */
export const Wordmark = ({ className, height = 28, href = '/landing.html' }: { className?: string; height?: number; href?: string }) => (
  <a href={href} className={cn('block w-fit shrink-0 rounded-sm', className)}>
    <img src="/wordmark.png" alt="I Missed That" draggable={false} style={{ height, width: 'auto' }}
      className="block drop-shadow-[2px_3px_3px_rgb(27_20_16/.6)] select-none" />
  </a>
);
