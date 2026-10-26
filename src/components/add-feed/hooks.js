import { useCallback, useState } from 'react';
import * as api from '../../utils/api.js';
import { normalizeUrl } from '../../utils/helpers.js';

const NO_FEEDS = 'No RSS feeds found for this URL. Try pasting a direct RSS feed URL, or use the Search tab to find feeds by keyword.';

/** Shared loading flag and error banner for the modal's network actions. */
export function useAsyncStatus() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(async (task, formatError = (err) => err.message) => {
    setLoading(true);
    setError('');
    try {
      await task();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, []);
  return { loading, error, setError, run };
}

// Parses url as a feed; null if it isn't one.
async function tryParseFeed(url) {
  try {
    const feed = await api.parseFeed(url);
    return feed?.title && feed.items ? feed : null;
  } catch {
    return null;
  }
}

/** URL tab: treat the URL as a feed, else discover feeds on the page. */
export function useFeedDiscovery(status) {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [discovered, setDiscovered] = useState([]);

  const discover = useCallback(() => {
    if (!url.trim()) return;
    setDiscovered([]);
    setPreview(null);
    const target = normalizeUrl(url.trim());
    status.run(async () => {
      const feed = await tryParseFeed(target);
      if (feed) return setPreview({ ...feed, feedUrl: target });
      const result = await api.discoverFeeds(target);
      if (result.feeds?.length > 0) setDiscovered(result.feeds);
      else status.setError(NO_FEEDS);
    }, (err) => err.message || 'Failed to discover feeds');
  }, [url, status]);

  const previewFeed = useCallback((feedUrl) => status.run(async () => {
    setPreview({ ...(await api.parseFeed(feedUrl)), feedUrl });
  }, (err) => `Could not parse feed: ${err.message}`), [status]);

  const clear = useCallback(() => { setPreview(null); setUrl(''); }, []);

  return { url, setUrl, preview, discovered, discover, previewFeed, clear };
}

/** Which feeds are already added, which is being added, and the add action. */
export function useFeedAdder({ onAddFeed, existingFeedUrls, folderId, setError }) {
  // Adds made in this dialog, until the library's feed list catches up.
  const [addedHere, setAddedHere] = useState(() => new Set());
  const [adding, setAdding] = useState(null);

  const add = useCallback(async (feedUrl) => {
    if (adding) return;
    setAdding(feedUrl);
    setError('');
    try {
      await onAddFeed(feedUrl, folderId ? parseInt(folderId) : null);
      setAddedHere((prev) => new Set([...prev, feedUrl]));
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(null);
    }
  }, [adding, onAddFeed, folderId, setError]);

  const isAdded = (url) => addedHere.has(url) || Boolean(existingFeedUrls?.includes(url));
  return { isAdded, adding, add };
}
