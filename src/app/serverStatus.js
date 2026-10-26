// Whether the local Tenwise server answers. Everything the app shows comes
// from it, so when it stops (its terminal closed, a crash, a port clash) every
// view would just look empty. A request that fails the way a missing server
// does starts a check of /api/health; while that fails it is checked again every
// few seconds, and subscribers hear when the server goes down and comes back.

export const RETRY_MS = 5000;
const CHECK_TIMEOUT_MS = 4000;

async function healthy() {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
    return res.ok && (await res.json()).status === 'ok';
  } catch {
    return false;
  }
}

// A timer that doesn't keep Node alive (tests import this through api.js).
function later(fn, ms) {
  const timer = setTimeout(fn, ms);
  timer.unref?.();
  return timer;
}

export function createServerStatus({ isHealthy = healthy, schedule = later, cancel = clearTimeout } = {}) {
  let down = false;
  let pending = null; // the check in flight
  let retry = null; // the next check, while down
  const listeners = new Set();

  function setDown(next) {
    if (next === down) return;
    down = next;
    listeners.forEach((listener) => listener(down));
  }

  /** Checks now (joining a check in flight); resolves to whether it answered. */
  function check() {
    pending ??= isHealthy().then((ok) => {
      pending = null;
      cancel(retry);
      retry = ok ? null : schedule(check, RETRY_MS);
      setDown(!ok);
      return ok;
    });
    return pending;
  }

  return {
    check,
    isDown: () => down,
    /** A request failed in a way that may mean the server is gone: confirm it. */
    reportFailure() {
      if (!down) check();
    },
    /** listener(down) on every change; returns the unsubscribe function. */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const serverStatus = createServerStatus();
