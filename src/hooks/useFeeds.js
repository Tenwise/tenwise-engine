import { useState, useEffect, useCallback } from 'react';
import * as api from '../utils/api.js';
import { createFeed, importNewFeeds } from '../utils/feedSync.js';

// The subscribed feeds, loaded once, plus a helper to swap in an updated one.
function useFeedList() {
  const [feeds, setFeeds] = useState([]);
  const reloadFeeds = useCallback(() => api.fetchFeeds().then(setFeeds).catch(() => {}), []);
  useEffect(() => { reloadFeeds(); }, [reloadFeeds]);
  const replaceFeed = useCallback((updated) => {
    setFeeds((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
  }, []);
  return { feeds, setFeeds, replaceFeed, reloadFeeds };
}

// Refreshes one feed in the server: { inserted, failed }. The server remembers
// a failure on the feed (the sidebar shows it) and clears it on a success.
async function refreshAndRecord(feed, replaceFeed) {
  try {
    const { inserted, failed, feed: updated } = await api.refreshFeedNow(feed.id);
    if (updated) replaceFeed(updated);
    return { inserted, failed };
  } catch (err) {
    console.error(`Failed to refresh feed ${feed.title}:`, err);
    return { inserted: 0, failed: true };
  }
}

// Refreshing one feed or all of them; resolves to { inserted, failed }.
function useFeedRefresh({ feeds, replaceFeed, reloadFeeds, onDataChanged }) {
  const refreshFeed = useCallback(async (feedId) => {
    const feed = feeds.find((f) => f.id === feedId);
    if (!feed) return { inserted: 0, failed: false };
    const result = await refreshAndRecord(feed, replaceFeed);
    if (result.inserted > 0) onDataChanged?.();
    return result;
  }, [feeds, replaceFeed, onDataChanged]);

  // Every feed; resolves to { inserted, failed: [feed titles] }.
  const refreshAllFeeds = useCallback(async () => {
    const tally = await api.refreshFeeds();
    await reloadFeeds();
    if (tally.inserted > 0) onDataChanged?.();
    return tally;
  }, [reloadFeeds, onDataChanged]);

  return { refreshFeed, refreshAllFeeds };
}

// OPML import; reloads the feed list, then has the server fetch articles for
// the new feeds in the background.
function useOPMLImport({ feeds, setFeeds, reloadFeeds, onDataChanged }) {
  return useCallback(async (parsedFeeds) => {
    const imported = await importNewFeeds(parsedFeeds, feeds);
    if (imported.length === 0) return 0;
    setFeeds(await api.fetchFeeds().catch(() => [...feeds, ...imported]));
    onDataChanged?.();
    api.refreshFeeds(imported.map((f) => f.id))
      .then(({ inserted }) => {
        reloadFeeds();
        if (inserted > 0) onDataChanged?.();
      })
      .catch(() => {});
    return imported.length;
  }, [feeds, setFeeds, reloadFeeds, onDataChanged]);
}

export function useFeeds(onDataChanged) {
  const { feeds, setFeeds, replaceFeed, reloadFeeds } = useFeedList();
  const refresh = useFeedRefresh({ feeds, replaceFeed, reloadFeeds, onDataChanged });
  const importFeedsFromOPML = useOPMLImport({ feeds, setFeeds, reloadFeeds, onDataChanged });

  const addFeed = useCallback(async (feedUrl, folderId = null) => {
    if (feeds.some((f) => f.url === feedUrl)) throw new Error('This feed is already added');
    const saved = await createFeed(feedUrl, folderId);
    setFeeds((prev) => [...prev, saved]);
    onDataChanged?.();
    return saved.id;
  }, [feeds, setFeeds, onDataChanged]);

  // Resolves to how many of its saved articles were kept.
  const removeFeed = useCallback(async (feedId) => {
    const { keptSaved = 0 } = await api.removeFeed(feedId);
    setFeeds((prev) => prev.filter((f) => f.id !== feedId));
    onDataChanged?.();
    return keptSaved;
  }, [setFeeds, onDataChanged]);

  const updateFeedFolder = useCallback(async (feedId, folderId) => {
    replaceFeed(await api.patchFeed(feedId, { folderId }));
  }, [replaceFeed]);

  return { feeds, reloadFeeds, addFeed, removeFeed, updateFeedFolder, ...refresh, importFeedsFromOPML };
}
