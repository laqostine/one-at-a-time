interface Props {
  name: string;
  color: string;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

/** Speaker color chip. Tappable (rename) when onClick is given. */
export function SpeakerChip({ name, color, onClick, size = 'md' }: Props) {
  const cls = `inline-flex max-w-[12em] shrink-0 items-center gap-1.5 rounded-full border font-semibold leading-none ${
    size === 'sm' ? 'px-2 py-1 text-[0.8rem]' : 'px-3 py-1.5 text-[0.95rem]'}`;
  const style = { borderColor: color, color, background: `${color}22` };
  const inner = (
    <>
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{name}</span>
    </>
  );
  if (!onClick) return <span className={cls} style={style}>{inner}</span>;
  return (
    <button type="button" onClick={onClick} className={`${cls} hover:brightness-125`} style={style}
      aria-label={`${name}, rename speaker`}>
      {inner}
    </button>
  );
}
