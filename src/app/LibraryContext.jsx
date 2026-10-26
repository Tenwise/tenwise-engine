import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useFeeds } from '../hooks/useFeeds.js';
import { useFolders } from '../hooks/useFolders.js';
import * as api from '../utils/api.js';
import { usePolling } from '../hooks/usePolling.js';
import { refreshNews, refreshSummary } from '../utils/feedSync.js';
import { serverStatus } from './serverStatus.js';
import { useToast } from './ToastContext.jsx';

const LibraryContext = createContext(null);

const plural = (n, word) => `${n} ${word}${n !== 1 ? 's' : ''}`;

// Removing feeds keeps their saved articles (with notes and collections).
const KEEPS_SAVES = 'Saved articles stay in Saved and your collections; the rest are deleted.';
const removedMessage = (what, kept) => (kept > 0 ? `${what}; kept ${plural(kept, 'saved article')}` : what);

// Feeds removed but kept for their saves: their names still label those saves.
function useRemovedFeeds() {
  const [removedFeeds, setRemovedFeeds] = useState([]);
  const reloadRemovedFeeds = useCallback(() => api.fetchRemovedFeeds().then(setRemovedFeeds).catch(() => {}), []);
  useEffect(() => { reloadRemovedFeeds(); }, [reloadRemovedFeeds]);
  return { removedFeeds, reloadRemovedFeeds };
}


// Keys bumped after mutations so lists and counts re-fetch.
function useRefreshKeys() {
  const [articlesKey, setArticlesKey] = useState(0);
  const [countsKey, setCountsKey] = useState(0);
  const bumpArticles = useCallback(() => {
    setArticlesKey((k) => k + 1);
    setCountsKey((k) => k + 1);
  }, []);
  const bumpCounts = useCallback(() => setCountsKey((k) => k + 1), []);
  return { articlesKey, countsKey, bumpArticles, bumpCounts };
}

const REFRESH_WATCH_MS = 60 * 1000;

// The server refreshes feeds on its own schedule; this checks once a minute
// and shows what a finished run brought (see refreshNews). Returns catchUp(),
// which notes the latest run without acting on it: for after a refresh this
// app asked for and has already shown.
function useServerRefreshes(reloadFeeds, bumpArticles) {
  const seen = useRef(undefined);
  const check = useCallback(async () => {
    const status = await api.fetchRefreshStatus().catch(() => null);
    if (!status) return;
    const news = refreshNews(seen.current, status);
    seen.current = status.lastFinishedAt;
    if (news.reloadFeeds) reloadFeeds();
    if (news.reloadArticles) bumpArticles();
  }, [reloadFeeds, bumpArticles]);
  usePolling(check, REFRESH_WATCH_MS);
  return useCallback(async () => {
    const status = await api.fetchRefreshStatus().catch(() => null);
    if (status) seen.current = status.lastFinishedAt;
  }, []);
}

// Refresh all (the toolbar button and ⌘K), with a toast, plus the scheduled
// runs the server does on its own.
function useRefreshing({ refreshAllFeeds, reloadFeeds, bumpArticles, showToast }) {
  const [refreshing, setRefreshing] = useState(false);
  const catchUpRefreshes = useServerRefreshes(reloadFeeds, bumpArticles);
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const tally = await refreshAllFeeds();
      await catchUpRefreshes();
      const { message, type } = refreshSummary(tally);
      showToast(message, type);
    } catch {
      showToast('Refreshing failed', 'error');
    } finally {
      setRefreshing(false);
    }
  }, [refreshAllFeeds, catchUpRefreshes, showToast]);
  return { refreshing, refreshAll };
}

// Folder deletes and Clear All Data. The server moves or deletes feeds as a
// side effect, so each reloads the feed list (and Clear All the folders too).
function useDestructiveActions({
  feeds, folders, reloadFeeds, reloadFolders, deleteFolderRaw, deleteFolderAndFeedsRaw,
  bumpArticles, bumpCounts, onViewRemoved, showToast, reloadRemovedFeeds,
}) {
  const deleteFolder = useCallback(async (folderId) => {
    await deleteFolderRaw(folderId);
    await reloadFeeds();
    showToast('Folder deleted — feeds moved to Uncategorized');
    onViewRemoved('folder', folderId);
  }, [deleteFolderRaw, reloadFeeds, showToast, onViewRemoved]);

  const deleteFolderAndFeeds = useCallback(async (folderId) => {
    const folder = folders.find((f) => f.id === folderId);
    const count = feeds.filter((f) => f.folderId === folderId).length;
    if (!window.confirm(`Delete "${folder?.name || 'this folder'}" and its ${plural(count, 'feed')}? ${KEEPS_SAVES}`)) return;
    const kept = await deleteFolderAndFeedsRaw(folderId);
    await Promise.all([reloadFeeds(), reloadRemovedFeeds()]);
    showToast(removedMessage('Folder and its feeds deleted', kept));
    bumpArticles();
    onViewRemoved('folder', folderId);
  }, [folders, feeds, deleteFolderAndFeedsRaw, reloadFeeds, reloadRemovedFeeds, showToast, bumpArticles, onViewRemoved]);

  // Settings → Danger Zone. Everything is gone, so reload it all and leave
  // any feed or folder view.
  const clearAll = useCallback(async () => {
    await api.clearAllData();
    await Promise.all([reloadFeeds(), reloadFolders(), reloadRemovedFeeds()]);
    bumpArticles();
    bumpCounts();
    onViewRemoved(null);
    showToast('All feeds, folders and articles deleted');
  }, [reloadFeeds, reloadFolders, reloadRemovedFeeds, bumpArticles, bumpCounts, onViewRemoved, showToast]);

  return { deleteFolder, deleteFolderAndFeeds, clearAll };
}

// When the server answers again after being unreachable, everything shown was
// loaded (or failed to load) without it, so load it all again. Queries are
// reset, not just invalidated: a query still waiting to retry (React Query
// holds retries while the tab is hidden) would otherwise keep waiting.
function useReloadOnReconnect({ reloadFeeds, reloadFolders, reloadRemovedFeeds, bumpCounts }) {
  const queryClient = useQueryClient();
  useEffect(() => serverStatus.subscribe((down) => {
    if (down) return;
    Promise.all([reloadFeeds(), reloadFolders(), reloadRemovedFeeds()]).catch(() => {});
    bumpCounts();
    queryClient.resetQueries();
  }), [reloadFeeds, reloadFolders, reloadRemovedFeeds, bumpCounts, queryClient]);
}

/**
 * Feeds, folders, and the actions on them (with toasts). onViewRemoved(type, id)
 * lets the app leave a view whose feed or folder was just deleted.
 */
function useLibraryState(onViewRemoved) {
  const showToast = useToast();
  const { articlesKey, countsKey, bumpArticles, bumpCounts } = useRefreshKeys();
  const { feeds, reloadFeeds, addFeed: addFeedRaw, removeFeed: removeFeedRaw, updateFeedFolder, refreshFeed, refreshAllFeeds, importFeedsFromOPML: importRaw } = useFeeds(bumpArticles);
  const { folders, reloadFolders, addFolder, renameFolder, deleteFolder: deleteFolderRaw, deleteFolderAndFeeds: deleteFolderAndFeedsRaw } = useFolders();
  const { removedFeeds, reloadRemovedFeeds } = useRemovedFeeds();
  const { refreshing, refreshAll } = useRefreshing({ refreshAllFeeds, reloadFeeds, bumpArticles, showToast });
  useReloadOnReconnect({ reloadFeeds, reloadFolders, reloadRemovedFeeds, bumpCounts });

  // An OPML import can create folders, so reload them along with the feeds.
  const importFeedsFromOPML = useCallback(async (parsedFeeds) => {
    const count = await importRaw(parsedFeeds);
    if (count > 0) await reloadFolders();
    return count;
  }, [importRaw, reloadFolders]);

  const addFeed = useCallback(async (feedUrl, folderId) => {
    try {
      await addFeedRaw(feedUrl, folderId);
      showToast('Feed added successfully!');
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  }, [addFeedRaw, showToast]);

  const removeFeed = useCallback(async (feedId) => {
    const feed = feeds.find((f) => f.id === feedId);
    if (!window.confirm(`Remove "${feed?.title || 'this feed'}"? ${KEEPS_SAVES}`)) return;
    const kept = await removeFeedRaw(feedId);
    if (kept > 0) reloadRemovedFeeds();
    showToast(removedMessage('Feed removed', kept));
    bumpArticles();
    onViewRemoved('feed', feedId);
  }, [feeds, removeFeedRaw, reloadRemovedFeeds, showToast, bumpArticles, onViewRemoved]);

  const moveFeed = useCallback(async (feedId, folderId) => {
    await updateFeedFolder(feedId, folderId);
    const folder = folders.find((f) => f.id === folderId);
    showToast(`Moved to ${folder ? folder.name : 'Uncategorized'}`);
  }, [updateFeedFolder, folders, showToast]);

  const refreshOneFeed = useCallback(async (feedId) => {
    const title = feeds.find((f) => f.id === feedId)?.title || 'Feed';
    const { inserted, failed } = await refreshFeed(feedId);
    if (failed) showToast(`${title} couldn't be refreshed; the sidebar shows why`, 'error');
    else showToast(`${title}: ${plural(inserted, 'new article')}`);
  }, [feeds, refreshFeed, showToast]);

  const { deleteFolder, deleteFolderAndFeeds, clearAll } = useDestructiveActions({
    feeds, folders, reloadFeeds, reloadFolders, deleteFolderRaw, deleteFolderAndFeedsRaw,
    bumpArticles, bumpCounts, onViewRemoved, showToast, reloadRemovedFeeds,
  });

  const existingFeedUrls = useMemo(() => feeds.map((f) => f.url), [feeds]);
  // Every feed an article can come from: subscribed, then removed but kept for saves.
  const sourceFeeds = useMemo(() => [...feeds, ...removedFeeds], [feeds, removedFeeds]);

  return useMemo(() => ({
    feeds, sourceFeeds, folders, existingFeedUrls, refreshing,
    articlesRefreshKey: articlesKey, countsRefreshKey: countsKey, bumpCounts,
    importFeedsFromOPML,
    onAddFeed: addFeed, onRemoveFeed: removeFeed, onMoveFeed: moveFeed, onRefreshAll: refreshAll, onRefreshFeed: refreshOneFeed,
    onAddFolder: addFolder, onRenameFolder: renameFolder,
    onDeleteFolder: deleteFolder, onDeleteFolderAndFeeds: deleteFolderAndFeeds, onClearAll: clearAll,
  }), [feeds, sourceFeeds, folders, existingFeedUrls, refreshing, articlesKey, countsKey, bumpCounts,
    importFeedsFromOPML, addFeed, removeFeed, moveFeed, refreshAll, refreshOneFeed, addFolder, renameFolder, deleteFolder, deleteFolderAndFeeds, clearAll]);
}

/** Feeds and folders with their actions, shared by Sidebar, Add Feed, and Settings. */
export function LibraryProvider({ onViewRemoved, children }) {
  const value = useLibraryState(onViewRemoved);
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useLibrary = () => useContext(LibraryContext);
