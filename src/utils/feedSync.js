// Feed operations behind useFeeds: adding a feed and OPML import. Refreshing
// happens in the server (server/refresh/), on its schedule or when asked
// through api.js. No React; every server call goes through api.js.
import * as api from './api.js';
import { getFaviconUrl } from './helpers.js';
import { firstOf, orEmpty, toArticle } from '../../shared/feedItems.js';

/** Parses and stores a new feed with its current articles; resolves to the saved feed. */
export async function createFeed(feedUrl, folderId) {
  const feedData = await api.parseFeed(feedUrl);
  const saved = await api.storeFeed({
    title: feedData.title,
    url: feedUrl,
    siteUrl: orEmpty(feedData.link),
    description: orEmpty(feedData.description),
    favicon: getFaviconUrl(feedData.link),
    folderId,
    lastRefreshed: new Date().toISOString(),
  });
  if (feedData.items?.length > 0) {
    await api.bulkInsertArticles(saved.id, feedData.items.map(toArticle)).catch(() => {});
  }
  return saved;
}

async function folderIdFor(folderName) {
  if (!folderName) return null;
  const folder = await api.findOrCreateFolder(folderName).catch(() => null);
  return folder?.id ?? null;
}

// Stores one OPML entry (creating its folder if needed); resolves to the saved feed, or null.
async function importFeed(feed) {
  return api.storeFeed({
    title: feed.title,
    url: feed.url,
    siteUrl: orEmpty(feed.siteUrl),
    description: '',
    favicon: getFaviconUrl(firstOf(feed.siteUrl, feed.url)),
    folderId: await folderIdFor(feed.folderName),
    lastRefreshed: null,
  }).catch(() => null);
}

/** Imports the OPML entries not already subscribed; resolves to the saved feeds. */
export async function importNewFeeds(parsedFeeds, feeds, store = importFeed) {
  const existingUrls = new Set(feeds.map((f) => f.url));
  const saved = [];
  for (const feed of parsedFeeds) {
    if (existingUrls.has(feed.url)) continue;
    const stored = await store(feed);
    if (!stored) continue;
    existingUrls.add(feed.url);
    saved.push(stored);
  }
  return saved;
}

/**
 * What a check of the server's scheduled refreshes means for the open app. A
 * run that finished since the one last seen reloads the feeds (refresh times,
 * failures); if it found articles, the lists and counts too. The first check
 * (nothing seen yet) only notes where things stand: the app just loaded them.
 */
export function refreshNews(seenFinishedAt, status) {
  const finished = seenFinishedAt !== undefined && status.lastFinishedAt !== seenFinishedAt;
  return { reloadFeeds: finished, reloadArticles: finished && status.lastInserted > 0 };
}

const plural = (n, word) => `${n} ${word}${n !== 1 ? 's' : ''}`;

/** The toast after refreshing every feed: new articles, and which feeds failed. */
export function refreshSummary({ inserted, failed }) {
  const found = `Refreshed: ${plural(inserted, 'new article')}`;
  if (failed.length === 0) return { message: found, type: 'success' };
  const which = failed.length <= 2 ? failed.join(' and ') : `${failed.length} feeds`;
  return { message: `${found}. ${which} couldn't be refreshed; the sidebar shows why.`, type: 'error' };
}
