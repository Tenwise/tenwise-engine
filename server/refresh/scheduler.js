// Auto-refresh runs in the server, so feeds keep updating with no browser tab
// open. A feed lists only its latest items: whatever scrolls off while nothing
// checks is never seen, and fast feeds (Techmeme, arXiv) scroll off in hours.
// The schedule checks once a minute and refreshes every feed once the
// interval has passed since the last run. A sleeping computer runs nothing;
// the first check after it wakes catches up.

export const DEFAULT_MINUTES = 30;
const MINUTE_MS = 60 * 1000;

/** Minutes between refreshes from settings.json: 0 is off; missing or unreadable is the default. */
export function refreshMinutes(settings) {
  const value = Number.parseInt(settings['tenwise-auto-refresh'], 10);
  if (!Number.isFinite(value)) return DEFAULT_MINUTES;
  return Math.max(0, value);
}

/** Whether a scheduled run is due: auto-refresh on, nothing running, and the interval passed (or no run yet). */
export function isDue({ minutes, running, lastStartedAt, now }) {
  if (minutes === 0 || running) return false;
  return lastStartedAt === null || now - lastStartedAt >= minutes * MINUTE_MS;
}

const iso = (ms) => (ms === null ? null : new Date(ms).toISOString());

/**
 * Refreshes every feed on demand or on schedule. `refreshAll()` resolves to
 * the run's { inserted, failed }; a call while a run is going joins it rather
 * than starting a second. `tick()` starts a run when one is due.
 */
export function createRefresher({ refreshAll, readMinutes, now = Date.now, log = console }) {
  let running = null;
  let lastStartedAt = null;
  let lastFinishedAt = null;
  let last = { inserted: 0, failed: [] };

  function finish(tally) {
    lastFinishedAt = now();
    last = tally;
    log.log(`Refreshed feeds: ${tally.inserted} new, ${tally.failed.length} failed`);
    return tally;
  }

  function runAll() {
    if (running) return running;
    lastStartedAt = now();
    // Through a promise, so even a refreshAll that throws at once only rejects.
    running = Promise.resolve().then(refreshAll).then(finish).finally(() => { running = null; });
    return running;
  }

  function tick() {
    if (!isDue({ minutes: readMinutes(), running: running !== null, lastStartedAt, now: now() })) return;
    runAll().catch((err) => log.error('Auto-refresh failed:', err));
  }

  /** What the browser polls to pick up scheduled runs. */
  function status() {
    return {
      running: running !== null,
      lastStartedAt: iso(lastStartedAt),
      lastFinishedAt: iso(lastFinishedAt),
      lastInserted: last.inserted,
      lastFailed: last.failed,
    };
  }

  return { runAll, tick, status };
}

/** Checks for a due run every minute; returns a function that stops the schedule. */
export function startSchedule(refresher, everyMs = MINUTE_MS) {
  // nosemgrep: ajinabraham.njsscan.eval.eval_node.eval_nodejs -- a function, never a code string
  const timer = setInterval(refresher.tick, everyMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
