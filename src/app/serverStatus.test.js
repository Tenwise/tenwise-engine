import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServerStatus, RETRY_MS } from './serverStatus.js';

// A status whose health answers come from `answers` (true = up), with timers
// held in `timers` so a test can fire the next retry by hand.
function setup(answers) {
  const timers = [];
  const changes = [];
  let calls = 0;
  const status = createServerStatus({
    isHealthy: async () => answers[Math.min(calls++, answers.length - 1)],
    schedule: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    cancel: () => {},
  });
  status.subscribe((down) => changes.push(down));
  return { status, timers, changes, calls: () => calls };
}

test('a failure that the health check confirms marks the server down and schedules a retry', async () => {
  const { status, timers, changes } = setup([false]);
  status.reportFailure();
  await status.check();
  assert.equal(status.isDown(), true);
  assert.deepEqual(changes, [true]);
  assert.equal(timers.at(-1).ms, RETRY_MS);
});

test('a failure the health check does not confirm changes nothing', async () => {
  const { status, timers, changes } = setup([true]);
  status.reportFailure();
  await status.check();
  assert.equal(status.isDown(), false);
  assert.deepEqual(changes, []);
  assert.equal(timers.length, 0);
});

test('the retry that finds the server back marks it up and stops retrying', async () => {
  const { status, timers, changes } = setup([false, false, true]);
  await status.check();
  await timers.at(-1).fn();
  assert.equal(status.isDown(), true);
  const before = timers.length;
  await timers.at(-1).fn();
  assert.equal(status.isDown(), false);
  assert.deepEqual(changes, [true, false]);
  assert.equal(timers.length, before);
});

test('checks in flight are shared, and failures while down start no new check', async () => {
  const { status, calls } = setup([false]);
  await Promise.all([status.check(), status.check(), status.check()]);
  assert.equal(calls(), 1);
  status.reportFailure();
  assert.equal(calls(), 1);
});
