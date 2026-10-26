import { useState } from 'react';
import { HiOutlineArrowTopRightOnSquare, HiOutlineExclamationCircle, HiOutlineNewspaper, HiOutlineTrash } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { useConfirmAction } from '../../hooks/useConfirmAction.js';

const ACTION = 'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-2 text-xs text-muted-foreground no-underline hover:bg-[var(--bg-hover)] hover:text-foreground disabled:opacity-50';

export function OpenInReaderButton({ onClick }) {
  return <button type="button" className={ACTION} onClick={onClick}><HiOutlineNewspaper className="size-3.5" /> Open in reader</button>;
}

export function OriginalLink({ url }) {
  if (!url) return null;
  return <a href={url} target="_blank" rel="noopener noreferrer" className={ACTION}><HiOutlineArrowTopRightOnSquare className="size-3.5" /> Original</a>;
}

/** Delete with a two-click confirmation (3 s). */
export function DeleteButton({ onDelete, what }) {
  const [deleting, setDeleting] = useState(false);
  const confirm = useConfirmAction(async () => {
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  }, 3000);
  return (
    <button type="button" className={cn(ACTION, confirm.armed && 'text-[var(--danger)] hover:text-[var(--danger)]')} onClick={confirm.trigger} disabled={deleting}>
      {confirm.armed ? <HiOutlineExclamationCircle className="size-3.5" /> : <HiOutlineTrash className="size-3.5" />}
      {confirm.armed ? 'Click again to delete' : `Delete ${what}`}
    </button>
  );
}

/** A row of actions, quiet until the item is hovered or focused (--dimmed-opacity: text stays at 4.5:1). */
export function ActionRow({ children }) {
  return <div className="mt-2 -ml-2 flex flex-wrap gap-0.5 opacity-[var(--dimmed-opacity)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{children}</div>;
}
