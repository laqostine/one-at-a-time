import { readable } from '@/lib/utils';

interface Props {
  name: string;
  color: string;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

/** Speaker color chip (color + name, never color alone). Tappable (rename) when onClick is given. */
export function SpeakerChip({ name, color, onClick, size = 'md' }: Props) {
  const cls = `inline-flex max-w-[12em] shrink-0 items-center gap-1.5 rounded-full border font-semibold leading-none transition-[filter] duration-150 ${
    size === 'sm' ? 'h-6 px-2 text-[0.78rem]' : 'h-8 px-3 text-[0.92rem]'}`;
  const style = { borderColor: `color-mix(in oklab, ${color} 55%, transparent)`, color: readable(color), background: `color-mix(in oklab, ${color} 14%, transparent)` };
  const inner = (
    <>
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{name}</span>
    </>
  );
  if (!onClick) return <span className={cls} style={style}>{inner}</span>;
  return (
    <button type="button" onClick={onClick} className={`${cls} cursor-pointer hover:brightness-125`} style={style}
      aria-label={`${name}, rename speaker`}>
      {inner}
    </button>
  );
}
