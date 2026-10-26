import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Two-step confirmation for bulk actions: the first call arms it (for
 * `timeoutMs`), a second call while armed runs the action.
 */
export function useConfirmAction(action, timeoutMs = 4000) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const trigger = useCallback(() => {
    clearTimeout(timerRef.current);
    if (armed) {
      setArmed(false);
      action();
      return;
    }
    setArmed(true);
    timerRef.current = setTimeout(() => setArmed(false), timeoutMs);
  }, [armed, action, timeoutMs]);

  return { armed, trigger };
}
