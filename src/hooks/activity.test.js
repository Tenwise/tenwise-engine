import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDLE_MS, createActivity, inUse } from './activity.js';
import { shouldPoll } from './usePolling.js';

// A document stand-in: visibility, and listeners by event type.
function fakeDocument() {
  const listeners = {};
  return {
    visibilityState: 'visible',
    addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
    fire: (type) => (listeners[type] ?? []).forEach((fn) => fn()),
  };
}

test('in use while shown and touched within IDLE_MS', () => {
  assert.equal(inUse({ hidden: false, lastInput: 0, now: IDLE_MS - 1 }), true);
  assert.equal(inUse({ hidden: false, lastInput: 0, now: IDLE_MS }), false);
  assert.equal(inUse({ hidden: true, lastInput: 0, now: 0 }), false);
});

test('a hidden tab is not active, and showing it again resumes', () => {
  const doc = fakeDocument();
  let now = 0;
  const activity = createActivity(doc, () => now);
  let resumed = 0;
  activity.onResume(() => { resumed += 1; });
  assert.equal(activity.active(), true);
  doc.visibilityState = 'hidden';
  doc.fire('visibilitychange');
  assert.equal(activity.active(), false);
  assert.equal(resumed, 0);
  now = 60_000;
  doc.visibilityState = 'visible';
  doc.fire('visibilitychange');
  assert.equal(activity.active(), true);
  assert.equal(resumed, 1);
});

test('an idle tab resumes on the first input, and only once', () => {
  const doc = fakeDocument();
  let now = 0;
  const activity = createActivity(doc, () => now);
  let resumed = 0;
  const off = activity.onResume(() => { resumed += 1; });
  now = IDLE_MS + 1;
  assert.equal(activity.active(), false);
  doc.fire('pointermove');
  doc.fire('keydown');
  assert.equal(activity.active(), true);
  assert.equal(resumed, 1);
  off();
  now += IDLE_MS + 1;
  doc.fire('pointerdown');
  assert.equal(resumed, 1);
});

test('input while in use is not a resume', () => {
  const doc = fakeDocument();
  const activity = createActivity(doc, () => 1000);
  let resumed = 0;
  activity.onResume(() => { resumed += 1; });
  doc.fire('scroll');
  assert.equal(resumed, 0);
});

test('without a document it is always active', () => {
  const activity = createActivity(undefined);
  assert.equal(activity.active(), true);
  assert.equal(typeof activity.onResume(() => {}), 'function');
});

test('a tick checks unless the tab is out of use where polling pauses', () => {
  const idle = { pauses: true, active: () => false };
  const inUseTab = { pauses: true, active: () => true };
  const engine = { pauses: false, active: () => false };
  assert.equal(shouldPoll({}, idle), false);
  assert.equal(shouldPoll({}, inUseTab), true);
  assert.equal(shouldPoll({}, engine), true, 'the engine on its own keeps polling');
  assert.equal(shouldPoll({ busy: true }, idle), true, 'work under way is watched from a hidden tab');
  assert.equal(shouldPoll({ when: () => false }, inUseTab), false, 'nothing to check');
  assert.equal(shouldPoll({ when: () => false, busy: true }, idle), false);
});

test('polling pauses only where a plugin turns pollWhenIdle off', async () => {
  const { setPlugins } = await import('../plugins/index.js');
  const { pausesWhenIdle } = await import('./activity.js');
  setPlugins([]);
  assert.equal(pausesWhenIdle(), false, 'the engine on its own');
  setPlugins([{ capabilities: [{ pollWhenIdle: false }] }]);
  assert.equal(pausesWhenIdle(), true, 'the hosted app');
  setPlugins(undefined);
});
