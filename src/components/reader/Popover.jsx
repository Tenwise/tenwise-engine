import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { useClickOutside } from '../../hooks/useClickOutside.js';

/** A trigger and a panel that closes on outside click; render(close) draws the panel. */
export default function Popover({ trigger, className, children }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useClickOutside(open, close);
  return (
    <div className="relative" ref={ref} data-open={open || undefined}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className={cn('absolute top-full right-0 z-40 mt-1 rounded-lg border border-border bg-[var(--bg-modal)] shadow-xl', className)}>
          {children(close)}
        </div>
      )}
    </div>
  );
}
