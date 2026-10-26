import { useEffect, useState } from 'react';

/** `value`, once it has stopped changing for `delay` ms. */
export function useDebouncedValue(value, delay) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
