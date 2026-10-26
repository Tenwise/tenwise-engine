import { HiOutlineExclamationCircle } from 'react-icons/hi2';
import { cn } from '@/lib/utils';

/** Small text button for the rail's action rows. */
export function RailAction({ className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn('inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-[var(--bg-hover)] hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5', className)}
      {...props}
    >
      {children}
    </button>
  );
}

/** An error line with an optional action (e.g. Retry). */
export function RailError({ message, children }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-3 py-2.5 text-[13px] text-foreground">
      <HiOutlineExclamationCircle className="mt-0.5 size-4 shrink-0 text-[var(--danger)]" />
      <span className="mr-auto">{message}</span>
      {children}
    </div>
  );
}

/** Centered empty state: icon, a line of text, and an action. */
export function RailEmpty({ Icon, text, children }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <Icon className="size-7 text-[var(--text-tertiary)]" />
      <p className="m-0 max-w-64 text-[13px] leading-relaxed text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}

/** Blinking cursor shown while tokens stream in. */
export const TypingCursor = () => <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-primary align-text-bottom" />;

/** Mono uppercase label. */
export const RailLabel = ({ children }) => <span className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--text-tertiary)]">{children}</span>;
