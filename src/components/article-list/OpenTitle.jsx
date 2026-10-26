import { cn } from '@/lib/utils';

/**
 * An article's title as the button that opens it: what Tab reaches and what a
 * screen reader announces. The row or card around it stays clickable for the
 * pointer; the button stops the click there so the article opens once.
 */
export function OpenTitle({ active, onOpen, className, children }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      aria-current={active ? 'true' : undefined}
      className={cn('min-w-0 cursor-pointer rounded-sm border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
    >
      {children}
    </button>
  );
}
