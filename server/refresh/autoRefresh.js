// The server's one refresher, wired to the database and settings.json. The
// schedule and the "refresh all" button share it, so they never run twice at once.
import { listFeeds } from '../db/reader.js';
import { readSettings } from '../settings.js';
import { refreshFeeds } from './feedRefresh.js';
import { createRefresher, refreshMinutes, startSchedule } from './scheduler.js';

export const refresher = createRefresher({
  refreshAll: () => refreshFeeds(listFeeds()),
  readMinutes: () => refreshMinutes(readSettings()),
});

/** Starts refreshing every feed on the auto-refresh interval; returns a function that stops it. */
export const startAutoRefresh = () => startSchedule(refresher);
