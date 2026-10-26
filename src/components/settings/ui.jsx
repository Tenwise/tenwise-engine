import { cn } from '@/lib/utils';

/** One setting: label and hint on the left, the control on the right (or below when stacked). */
export function Row({ label, hint, stacked, children }) {
  return (
    <div className={cn('flex gap-x-6 gap-y-3 border-b border-border py-4 last:border-b-0', stacked ? 'flex-col' : 'items-center justify-between')}>
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-foreground">{label}</div>
        {hint && <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</div>}
      </div>
      <div className={cn(stacked ? 'w-full' : 'shrink-0')}>{children}</div>
    </div>
  );
}

/** A row of mutually exclusive options. */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-md border border-border bg-[var(--bg-primary)] p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'h-7 cursor-pointer rounded-[5px] border-0 px-2.5 text-xs font-medium transition-colors',
            value === opt.value ? 'bg-[var(--bg-active)] text-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** On/off switch. */
export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 cursor-pointer rounded-full border-0 p-0 transition-colors',
        checked ? 'bg-primary' : 'bg-[var(--bg-active)]',
      )}
    >
      <span className={cn('absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} />
    </button>
  );
}

/** Native select in the settings style. */
export function Select({ value, onChange, children, label }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 min-w-48 rounded-md border border-border bg-[var(--bg-primary)] px-2 text-[13px] text-foreground outline-none focus:border-primary"
    >
      {children}
    </select>
  );
}

/** A small "Default" / "Edited" marker with an optional reset. */
export function EditedBadge({ edited, onReset }) {
  if (!edited) return <span className="font-mono text-[11px] text-[var(--text-tertiary)]">default</span>;
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] text-primary">
      edited
      <button type="button" onClick={onReset} className="cursor-pointer border-0 bg-transparent p-0 text-[11px] text-muted-foreground underline hover:text-foreground">reset</button>
    </span>
  );
}
