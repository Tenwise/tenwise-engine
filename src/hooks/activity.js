// Whether this tab is in use: shown, with input in the last IDLE_MS. Where a
// plugin turns the pollWhenIdle capability off (the hosted app, TD-8), polling
// skips its checks while the tab isn't in use, so a tab left open lets its
// workspace sleep, and checks once when the person comes back.
import { capability } from '../plugins/index.js';

export const IDLE_MS = 5 * 60_000;

// Input that says someone is at the tab. Listened to passively, on the
// capture phase, so nothing in the page can hide it.
const INPUT = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];

/** The rule: in use while shown and touched in the last IDLE_MS. */
export const inUse = ({ hidden, lastInput, now }) => !hidden && now - lastInput < IDLE_MS;

/**
 * Tracks one document's activity: { active(), onResume(fn) → off }. onResume's
 * listeners run when the tab is shown again, or on the first input after it
 * went idle. Without a document (Node, tests) it is always active.
 */
export function createActivity(doc, now = Date.now) {
  if (!doc) return { active: () => true, onResume: () => () => {} };
  let lastInput = now();
  const listeners = new Set();
  const state = () => ({ hidden: doc.visibilityState === 'hidden', lastInput, now: now() });
  const resume = () => listeners.forEach((fn) => fn());
  const input = () => {
    const wasIdle = !inUse(state());
    lastInput = now();
    if (wasIdle && inUse(state())) resume();
  };
  const shown = () => {
    if (doc.visibilityState === 'hidden') return;
    lastInput = now();
    resume();
  };
  for (const type of INPUT) doc.addEventListener(type, input, { capture: true, passive: true });
  doc.addEventListener('visibilitychange', shown);
  return {
    active: () => inUse(state()),
    onResume: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

let activity = null;
const current = () => (activity ??= createActivity(globalThis.document));

/** Whether polling may skip its checks while the tab isn't in use: off unless a plugin says so. */
export const pausesWhenIdle = () => !capability('pollWhenIdle');

/** Whether this tab is in use now. */
export const tabActive = () => current().active();

/** Runs fn when the tab is in use again; returns a function that stops it. */
export const onTabResume = (fn) => current().onResume(fn);
