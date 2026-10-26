import { useCallback, useState } from 'react';
import { HiOutlineCheck, HiOutlineChevronDown } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { useClickOutside } from '../../hooks/useClickOutside.js';
import { useMenuKeys } from '../../hooks/useMenuKeys.js';

const modelLabel = (name) => (name ? name.split(':')[0].replace(/-/g, ' ') : 'No model');

/** Header menu for choosing the rail's AI model. */
export default function ModelPicker({ models, selectedModel, onSelect }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useClickOutside(open, close);
  const [menuRef, onMenuKeyDown] = useMenuKeys(open, close);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        title="Model"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border bg-transparent px-2 font-mono text-[11px] text-muted-foreground hover:text-foreground"
      >
        {modelLabel(selectedModel)}
        <HiOutlineChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && models.length > 0 && (
        <div role="menu" aria-label="Model" tabIndex={-1} ref={menuRef} onKeyDown={onMenuKeyDown} className="absolute top-full right-0 z-30 mt-1 min-w-48 rounded-md border border-border bg-[var(--bg-modal)] p-1 shadow-lg">
          {models.map((m) => (
            <button
              key={m.name}
              type="button"
              role="menuitemradio"
              aria-checked={m.name === selectedModel}
              onClick={() => { onSelect(m.name); setOpen(false); }}
              className="flex w-full cursor-pointer items-center gap-2 rounded border-0 bg-transparent px-2 py-1.5 text-left text-[12.5px] text-foreground hover:bg-[var(--bg-hover)]"
            >
              <span className="flex-1 truncate">{m.name.split(':')[0]}</span>
              {m.parameterSize && <span className="font-mono text-[10.5px] text-[var(--text-tertiary)]">{m.parameterSize}</span>}
              {m.name === selectedModel && <HiOutlineCheck className="size-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
