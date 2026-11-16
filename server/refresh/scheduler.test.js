import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRefresher, DEFAULT_MINUTES, isDue, refreshMinutes, startSchedule } from './scheduler.js';

const MIN = 60 * 1000;
const flush = () => new Promise((resolve) => { setImmediate(resolve); });

/**
 * A refresher on a hand-set clock (`clock.now`, in ms). Its runs wait until
 * the test calls finish(tally), unless `refreshAll` is given; logged errors
 * collect in `errors`.
 */
function setup({ minutes = 15, refreshAll } = {}) {
  const clock = { now: 0 };
  const calls = [];
  const errors = [];
  const refresher = createRefresher({
    refreshAll: refreshAll ?? (() => new Promise((resolve) => { calls.push(resolve); })),
    readMinutes: () => minutes,
    now: () => clock.now,
    log: { log() {}, error: (...args) => errors.push(args) },
  });
  return { refresher, clock, calls, errors, finish: (tally) => calls.at(-1)(tally) };
}

// Ticks at `minute`; resolves to how many runs have started so far.
async function tickAt(t, minute) {
  t.clock.now = minute * MIN;
  t.refresher.tick();
  await flush();
  return t.calls.length;
}

test('refreshMinutes reads the setting: 0 is off, missing or unreadable is the default', () => {
  assert.equal(refreshMinutes({ 'tenwise-auto-refresh': '15' }), 15);
  assert.equal(refreshMinutes({ 'tenwise-auto-refresh': '0' }), 0);
  assert.equal(refreshMinutes({}), DEFAULT_MINUTES);
  assert.equal(refreshMinutes({ 'tenwise-auto-refresh': 'soon' }), DEFAULT_MINUTES);
  assert.equal(refreshMinutes({ 'tenwise-auto-refresh': '-5' }), 0);
});

test('isDue: never while off or running; at once before the first run; then after the interval', () => {
  const base = { minutes: 15, running: false, lastStartedAt: null, now: 100 * MIN };
  assert.equal(isDue(base), true);
  assert.equal(isDue({ ...base, minutes: 0 }), false);
  assert.equal(isDue({ ...base, running: true }), false);
  assert.equal(isDue({ ...base, lastStartedAt: 90 * MIN }), false);
  assert.equal(isDue({ ...base, lastStartedAt: 85 * MIN }), true);
  assert.equal(isDue({ ...base, lastStartedAt: 10 * MIN }), true, 'catches up after the computer sleeps');
});

test('tick starts a run only when one is due', async () => {
  const t = setup();
  assert.equal(await tickAt(t, 0), 1);
  assert.equal(await tickAt(t, 1), 1, 'not while running');
  t.finish({ inserted: 2, failed: [] });
  await flush();
  assert.equal(t.refresher.status().running, false);
  assert.equal(await tickAt(t, 10), 1, 'not before the interval');
  assert.equal(await tickAt(t, 15), 2);
});

test('runAll joins a run in progress and reports it in status', async () => {
  const t = setup({ minutes: 0 });
  t.clock.now = 5 * MIN;
  assert.deepEqual(t.refresher.status(), { running: false, lastStartedAt: null, lastFinishedAt: null, lastInserted: 0, lastFailed: [], progress: null });
  const run = t.refresher.runAll();
  assert.equal(t.refresher.runAll(), run, 'a second call joins the first');
  await flush();
  assert.deepEqual([t.calls.length, t.refresher.status().running], [1, true]);
  t.clock.now = 6 * MIN;
  t.finish({ inserted: 4, failed: ['Techmeme'] });
  assert.deepEqual(await run, { inserted: 4, failed: ['Techmeme'] });
  assert.deepEqual(t.refresher.status(), {
    running: false,
    lastStartedAt: new Date(5 * MIN).toISOString(),
    lastFinishedAt: new Date(6 * MIN).toISOString(),
    lastInserted: 4,
    lastFailed: ['Techmeme'],
    progress: null,
  });
});

test('runFeeds fetches just the new feeds after the run under way, with progress in status (OPS-19)', async () => {
  const some = [];
  const clock = { now: 0 };
  let finishAll;
  const refresher = createRefresher({
    refreshAll: () => new Promise((resolve) => { finishAll = resolve; }),
    refreshSome: (ids, onProgress) => new Promise((resolve) => { some.push({ ids, onProgress, resolve }); }),
    readMinutes: () => 0,
    now: () => clock.now,
    log: { log() {}, error() {} },
  });
  const all = refresher.runAll();
  const imported = refresher.runFeeds([7, 8, 9]);
  await flush();
  assert.equal(some.length, 0, 'waits for the run of every feed');
  finishAll({ inserted: 1, failed: [] });
  await all;
  await flush();
  assert.deepEqual(some.map((s) => s.ids), [[7, 8, 9]]);
  some[0].onProgress({ done: 2, total: 3 });
  assert.deepEqual([refresher.status().running, refresher.status().progress], [true, { done: 2, total: 3 }]);
  const joined = refresher.runAll();
  some[0].resolve({ inserted: 12, failed: [] });
  assert.deepEqual(await imported, { inserted: 12, failed: [] });
  await flush();
  assert.equal(refresher.status().progress?.total ?? 0, 0, 'a Sync during the import ran after it, as a run of every feed');
  finishAll({ inserted: 0, failed: [] });
  await joined;
  assert.deepEqual([refresher.status().running, refresher.status().progress, refresher.status().lastInserted], [false, null, 0]);
});

test('a run that fails rejects, is logged by tick instead of crashing, and the next run still starts', async () => {
  let attempts = 0;
  const t = setup({ refreshAll: () => { attempts += 1; throw new Error('database is locked'); } });
  await assert.rejects(t.refresher.runAll(), /database is locked/);
  assert.deepEqual([t.refresher.status().running, t.refresher.status().lastFinishedAt], [false, null]);
  await tickAt(t, 15);
  assert.equal(attempts, 2);
  assert.equal(t.errors.length, 1);
});

test('startSchedule checks soon after starting, then on the interval, and stops cleanly', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  let ticks = 0;
  const stop = startSchedule({ tick: () => { ticks += 1; } }, 40, 5);
  t.mock.timers.tick(5);
  assert.equal(ticks, 1, 'the first check comes before the interval');
  t.mock.timers.tick(35);
  assert.equal(ticks, 2);
  stop();
  t.mock.timers.tick(200);
  assert.equal(ticks, 2, 'nothing after stop');
});
