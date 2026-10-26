import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRefresher, DEFAULT_MINUTES, isDue, refreshMinutes } from './scheduler.js';

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
  assert.deepEqual(t.refresher.status(), { running: false, lastStartedAt: null, lastFinishedAt: null, lastInserted: 0, lastFailed: [] });
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
  });
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
