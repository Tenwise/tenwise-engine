import { useEffect } from 'react';

/** Calls `load` now and then every `ms` milliseconds while mounted. */
export function usePolling(load, ms) {
  useEffect(() => {
    load();
    const timer = setInterval(load, ms);
    return () => clearInterval(timer);
  }, [load, ms]);
}
