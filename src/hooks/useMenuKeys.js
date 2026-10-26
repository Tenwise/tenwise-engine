import { useCallback, useEffect, useRef } from 'react';

const ITEMS = '[role^="menuitem"]:not(:disabled)';

const MOVES = {
  ArrowDown: (i, n) => (i + 1) % n,
  ArrowUp: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (i, n) => n - 1,
};

/**
 * Index of the item to focus after `key`, from item `index` (-1 when focus
 * is outside the menu) of `count`; arrows wrap around. Undefined for keys
 * that don't move, or an empty menu.
 */
export function menuMoveIndex(key, index, count) {
  if (count === 0 || !MOVES[key]) return undefined;
  return MOVES[key](Math.max(index, key === 'ArrowUp' ? 0 : -1), count);
}

// Puts focus back where it was before the menu opened, unless something
// else has taken it since (a rename field the menu item opened, say).
function restoreFocus(opener) {
  const current = document.activeElement;
  const unclaimed = !current || current === document.body;
  if (unclaimed && opener?.isConnected) opener.focus();
}

// Focuses the menu's first item; the returned cleanup restores focus on close.
function focusOnOpen(menu) {
  const opener = document.activeElement;
  menu?.querySelector(ITEMS)?.focus();
  return () => restoreFocus(opener);
}

// Escape and Tab close the menu; Escape stops there, so it doesn't also clear
// the list selection or close the reader. Returns whether the key closed it.
function closeOnKey(e, onClose) {
  if (e.key !== 'Escape' && e.key !== 'Tab') return false;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
  onClose();
  return true;
}

// Arrows, Home and End move focus between the menu's items.
function moveFocus(e, menu) {
  const items = [...(menu?.querySelectorAll(ITEMS) || [])];
  const next = menuMoveIndex(e.key, items.indexOf(document.activeElement), items.length);
  if (next === undefined) return;
  e.preventDefault();
  items[next].focus();
}

/**
 * Keyboard for a role="menu" popup (the WAI-ARIA menu pattern): while `open`,
 * focus starts on the first item, arrows and Home/End move between items,
 * Escape and Tab close it, and closing returns focus to where it was. Put
 * the returned ref and key handler on the menu element.
 */
export function useMenuKeys(open, onClose) {
  const ref = useRef(null);
  useEffect(() => (open ? focusOnOpen(ref.current) : undefined), [open]);
  const onKeyDown = useCallback((e) => {
    if (!closeOnKey(e, onClose)) moveFocus(e, ref.current);
  }, [onClose]);
  return [ref, onKeyDown];
}
