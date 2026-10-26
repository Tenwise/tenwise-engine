import { useEffect } from 'react';
import { hasModifier, isTyping } from '../../hooks/keys.js';

// Esc clears the selection first, then closes search.
function escape({ search, selection }) {
  if (selection.size > 0) selection.clear();
  else if (search.visible) search.close();
}

// '/' opens search, unless the user is typing (then it's just a slash).
function slash(e, { search }) {
  if (isTyping(e.target)) return;
  e.preventDefault();
  search.open();
}

const HANDLERS = { '/': slash, Escape: (e, ctx) => escape(ctx) };

/** '/' opens and focuses search; Esc clears the selection, then closes search. */
export function useListKeyboard({ search, selection }) {
  useEffect(() => {
    const handler = (e) => {
      if (hasModifier(e)) return;
      HANDLERS[e.key]?.(e, { search, selection });
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [search, selection]);
}
