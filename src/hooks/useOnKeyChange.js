import { useState } from 'react';

/**
 * Runs onChange during render when key changes — React's recommended way to
 * reset state on a prop change without an effect (no stale-state paint).
 */
export function useOnKeyChange(key, onChange) {
  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    setPrevKey(key);
    onChange();
  }
}
