import { useEffect, useRef } from 'react';
import { onTabResume, pausesWhenIdle, tabActive } from './activity.js';

const always = () => true;

/**
 * Whether a tick checks: when() allows it, and, where polling pauses while
 * the tab isn't in use (activity.js), the tab is in use or work is under way
 * (busy) that the person should see finish.
 */
export function shouldPoll(options, tab = { pauses: pausesWhenIdle(), active: tabActive }) {
  if (!(options.when ?? always)()) return false;
  return Boolean(options.busy) || !tab.pauses || tab.active();
}

/**
 * Calls `load` now and then every `ms` milliseconds while mounted. Options,
 * read at each tick: when() skips a tick that has nothing to check (say, an
 * empty queue); busy keeps checking while the tab is hidden or idle. Where
 * polling pauses while the tab isn't in use, `load` also runs once when the
 * person comes back (TD-8).
 */
export function usePolling(load, ms, options = {}) {
  const latest = useRef(options);
  useEffect(() => { latest.current = options; });
  useEffect(() => {
    load();
    const timer = setInterval(() => { if (shouldPoll(latest.current)) load(); }, ms);
    const off = pausesWhenIdle() ? onTabResume(() => { if ((latest.current.when ?? always)()) load(); }) : () => {};
    return () => {
      clearInterval(timer);
      off();
    };
  }, [load, ms]);
}
