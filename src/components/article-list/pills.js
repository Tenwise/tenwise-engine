// The filter row's pill look, shared with plugins' pills.
export const PILL = 'inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[11.5px] transition-colors [&_svg]:size-3';
export const pillState = (on) => (on ? 'border-primary bg-[var(--accent-muted)] text-foreground' : 'border-border bg-transparent text-muted-foreground hover:text-foreground');
