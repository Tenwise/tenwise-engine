import { useCallback, useEffect, useRef } from 'react';

/** Wraps fn so it does nothing once `signal` is aborted (stopped, or superseded). */
export function whileCurrent(signal, fn) {
  return (...args) => {
    if (!signal.aborted) fn(...args);
  };
}

/**
 * One AI generation at a time. start() aborts any previous run and returns the
 * new run's AbortSignal; cancel() aborts the current run (Stop, or the article
 * changed). Pass the signal down to the stream so the request itself stops,
 * and check `signal.aborted` before writing results into state.
 */
export function useStreamRun() {
  const controllerRef = useRef(null);
  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);
  const start = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    return controllerRef.current.signal;
  }, []);
  useEffect(() => cancel, [cancel]);
  return { start, cancel };
}
