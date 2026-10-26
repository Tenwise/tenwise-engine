import { useEffect, useRef } from 'react';

/**
 * Calls onOutside when a mousedown lands outside the returned ref's element,
 * while `active` is true (e.g. a dropdown is open).
 */
export function useClickOutside(active, onOutside) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [active, onOutside]);
  return ref;
}
