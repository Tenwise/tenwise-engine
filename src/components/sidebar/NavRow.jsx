import { HiOutlineEllipsisHorizontal, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import { cn } from '@/lib/utils';

// A warning icon with its message as the tooltip (hidden under the "…" button on hover).
function Alert({ text, hideOnHover }) {
  if (!text) return null;
  return (
    <span title={text} aria-label={text} className={cn('flex shrink-0 text-[var(--warning)]', hideOnHover && 'group-hover/nav:invisible')}>
      <HiOutlineExclamationTriangle className="size-3.5" />
    </span>
  );
}

function Count({ count, hideOnHover }) {
  if (!(count > 0)) return null;
  return <span className={cn('font-mono text-[11.5px] text-[var(--text-tertiary)]', hideOnHover && 'group-hover/nav:invisible')}>{count}</span>;
}

/**
 * One sidebar entry: icon, label, an optional warning (with its message as
 * the tooltip), unread count, and (optionally) a "…" button that replaces
 * the count on hover. Right-click opens the same menu. The entry itself is a
 * button that fills the rest of the row; `children` (a folder's expand toggle)
 * come before it and the "…" button floats over its end, so no control nests
 * in another.
 */
export function NavRow({ active, onClick, onMenu, menuTitle, icon, label, count, alert, className, children }) {
  return (
    <div
      onContextMenu={onMenu}
      className={cn(
        'group/nav relative flex h-8 items-center rounded-md text-[13px] select-none transition-colors',
        active ? 'bg-[var(--bg-active)] text-foreground' : 'text-muted-foreground hover:bg-[var(--bg-hover)] hover:text-foreground',
      )}
    >
      {children}
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={onClick}
        className={cn(
          'flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-2.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring',
          className,
        )}
      >
        <span className={cn('flex size-4 shrink-0 items-center justify-center [&_svg]:size-4', active && 'text-primary')}>{icon}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <Alert text={alert} hideOnHover={Boolean(onMenu)} />
        <Count count={count} hideOnHover={Boolean(onMenu)} />
      </button>
      {onMenu && (
        <button
          type="button"
          title={menuTitle}
          aria-label={menuTitle}
          aria-haspopup="menu"
          onClick={onMenu}
          className="absolute right-1.5 flex size-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-muted-foreground opacity-0 group-hover/nav:opacity-100 hover:bg-[var(--bg-tertiary)] hover:text-foreground focus-visible:opacity-100"
        >
          <HiOutlineEllipsisHorizontal className="size-4" />
        </button>
      )}
    </div>
  );
}

/** Small inline text field (new folder, rename). */
export function InlineInput({ className, ...props }) {
  return (
    <input
      className={cn('h-7 min-w-0 flex-1 rounded-md border border-border bg-[var(--bg-primary)] px-2 font-sans text-[12.5px] text-foreground outline-none focus:border-primary', className)}
      {...props}
    />
  );
}
