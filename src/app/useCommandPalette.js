import { useEffect, useState } from 'react';
import { on } from '../lib/appEvents.js';

const hasCommandKey = (e) => e.metaKey || e.ctrlKey;
const isPaletteKey = (e) => e.key.toLowerCase() === 'k' && hasCommandKey(e);

/** Open state of the command palette; ⌘K (Ctrl+K) toggles it, the 'open-palette' event opens it. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!isPaletteKey(e)) return;
      e.preventDefault();
      setOpen((prev) => !prev);
    };
    window.addEventListener('keydown', onKeyDown);
    const offOpen = on('open-palette', () => setOpen(true)); // the sidebar's search bar
    return () => { window.removeEventListener('keydown', onKeyDown); offOpen(); };
  }, []);
  return [open, setOpen];
}
