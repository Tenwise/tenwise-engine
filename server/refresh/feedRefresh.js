// Refreshing feeds in the server: fetch each feed, store what's new, queue it
// for background AI, and record the outcome on the feed. Used by the schedule
// (scheduler.js) and by the refresh buttons (routes/refresh.js).
import { parseFeed } from '../utils/feedParser.js';
import {
  bulkInsertArticles, bulkUpdateArticles, getQueueCount, getUnprocessedForFeed, updateFeed,
} from '../db/reader.js';
import { readSettings } from '../settings.js';
import { firstOf, toArticle } from '../../shared/feedItems.js';
import { batchSlots, parseBatchSettings } from '../../shared/batchScope.js';

const CONCURRENCY = 5;
// A failure's reason is shown in the sidebar; keep it short.
const ERROR_MAX = 300;

// Queues a feed's newest unprocessed articles for background AI, up to the per-cycle limit.
function queueForBatch(feed) {
  const settings = parseBatchSettings(readSettings()['tenwise-batch-ai']);
  const slots = batchSlots(settings, feed, getQueueCount());
  if (slots <= 0) return;
  const ids = getUnprocessedForFeed(feed.id, slots).map((a) => a.id);
  bulkUpdateArticles(ids, { aiStatus: 'queued' });
}

function recordFailure(feed, error) {
  return updateFeed(feed.id, {
    lastError: String(error?.message || error).slice(0, ERROR_MAX),
    lastErrorAt: new Date().toISOString(),
  });
}

/**
 * Fetches a feed and stores its new articles. A success clears an earlier
 * failure; a failure is remembered on the feed. Either way it resolves to
 * { inserted, failed, feed } with the updated feed.
 */
export async function refreshFeed(feed, parse = parseFeed) {
  try {
    const data = await parse(feed.url);
    const inserted = bulkInsertArticles(feed.id, firstOf(data.items, []).map(toArticle));
    if (inserted > 0) queueForBatch(feed);
    const updated = updateFeed(feed.id, {
      lastRefreshed: new Date().toISOString(),
      title: firstOf(data.title, feed.title),
      lastError: null,
      lastErrorAt: null,
    });
    return { inserted, failed: false, feed: updated };
  } catch (error) {
    return { inserted: 0, failed: true, feed: recordFailure(feed, error) };
  }
}

/**
 * Adds Promise.allSettled results of refreshFeed ({ inserted, failed }) to a
 * running tally { inserted, failed: [feed titles] }. A rejection counts as a
 * failure of that feed.
 */
export function tallyRefreshes(tally, results, chunk) {
  results.forEach((r, i) => {
    const value = r.status === 'fulfilled' ? r.value : { inserted: 0, failed: true };
    tally.inserted += value?.inserted || 0;
    if (value?.failed) tally.failed.push(chunk[i].title);
  });
  return tally;
}

/** Refreshes feeds a few at a time; resolves to { inserted, failed: [feed titles] }. */
export async function refreshFeeds(feeds, refresh = refreshFeed) {
  const tally = { inserted: 0, failed: [] };
  for (let i = 0; i < feeds.length; i += CONCURRENCY) {
    const chunk = feeds.slice(i, i + CONCURRENCY);
    tallyRefreshes(tally, await Promise.allSettled(chunk.map((f) => refresh(f))), chunk);
  }
  return tally;
}
