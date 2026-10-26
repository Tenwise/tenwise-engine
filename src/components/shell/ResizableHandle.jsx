import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const LINE = 'after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border after:transition-all hover:after:w-0.5 hover:after:bg-primary';
const ACTIVE = 'after:w-0.5 after:bg-primary';

/**
 * Drag handle that reports horizontal movement (onResize(deltaX)).
 * `overlay` sits on the left edge of a pane (reader, rail) instead of
 * taking space between two panes (sidebar).
 */
export default function ResizableHandle({ onResize, overlay, className }) {
  const startXRef = useRef(0);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    setDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const move = (ev) => {
      onResize(ev.clientX - startXRef.current);
      startXRef.current = ev.clientX;
    };
    const up = () => {
      setDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [onResize]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize"
      onPointerDown={onPointerDown}
      className={cn(
        'relative shrink-0 cursor-col-resize',
        overlay ? 'absolute inset-y-0 -left-[3px] z-[120] w-1.5' : 'z-10 w-1',
        LINE,
        dragging && ACTIVE,
        className,
      )}
    />
  );
}
