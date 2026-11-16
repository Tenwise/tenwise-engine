// Auto-refresh runs in the server, so feeds keep updating with no browser tab
// open. A feed lists only its latest items: whatever scrolls off while nothing
// checks is never seen, and fast feeds (Techmeme, arXiv) scroll off in hours.
// The schedule checks once a minute and refreshes every feed once the
// interval has passed since the last run. A sleeping computer runs nothing;
// the first check after it wakes catches up. The first check comes a few
// seconds after the server starts, so a hosted workspace that was asleep
// (OPS-15: nothing wakes it on a schedule) catches up as soon as it's opened.

export const DEFAULT_MINUTES = 30;
const MINUTE_MS = 60 * 1000;

/** How long after the server starts the first check comes: long enough not to slow the first page. */
export const FIRST_CHECK_MS = 5 * 1000;

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
/**
 * The one refresher: every feed (runAll: the schedule, Sync), or some
 * (runFeeds: feeds just imported, OPS-19), one run at a time. refreshAll(onProgress)
 * and refreshSome(ids, onProgress) do the work; status() is what the app polls.
 */
export function createRefresher({ refreshAll, refreshSome = () => ({ inserted: 0, failed: [] }), readMinutes, now = Date.now, log = console }) {
  let running = null;
  let runningAll = false;
  let progress = null;
  let lastStartedAt = null;
  let lastFinishedAt = null;
  let last = { inserted: 0, failed: [] };

  function finish(tally) {
    lastFinishedAt = now();
    last = tally;
    log.log(`Refreshed feeds: ${tally.inserted} new, ${tally.failed.length} failed`);
    return tally;
  }

  function begin(work, all) {
    lastStartedAt = now();
    runningAll = all;
    progress = { done: 0, total: 0 };
    const onProgress = (p) => { progress = p; };
    // Through a promise, so even work that throws at once only rejects.
    running = Promise.resolve().then(() => work(onProgress)).then(finish).finally(() => { running = null; progress = null; });
    return running;
  }

  // After the run under way, whatever it did.
  const after = (next) => running.catch(() => {}).then(next);

  /** Every feed; joins a run of every feed that's under way, and follows any other. */
  function runAll() {
    if (running) return runningAll ? running : after(runAll);
    return begin(refreshAll, true);
  }

  /** Just these feeds (by id), after any run under way. */
  function runFeeds(ids) {
    if (running) return after(() => runFeeds(ids));
    return begin((onProgress) => refreshSome(ids, onProgress), false);
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
      // While running: how many of its feeds are done, { done, total }.
      progress,
    };
  }

  return { runAll, runFeeds, tick, status };
}

/** Checks for a due run soon after starting, then every minute; returns a function that stops the schedule. */
export function startSchedule(refresher, everyMs = MINUTE_MS, firstMs = FIRST_CHECK_MS) {
  // nosemgrep: ajinabraham.njsscan.eval.eval_node.eval_nodejs -- a function, never a code string
  const first = setTimeout(refresher.tick, firstMs);
  // nosemgrep: ajinabraham.njsscan.eval.eval_node.eval_nodejs -- a function, never a code string
  const timer = setInterval(refresher.tick, everyMs);
  first.unref?.();
  timer.unref?.();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
