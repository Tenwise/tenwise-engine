import { Router } from 'express';
import { discoverFeeds } from '../utils/feedDiscovery.js';
import { getFeedByUrl } from '../db/reader.js';

// A feed already followed at any of its addresses is listed at that address,
// marked `followed`, so Add feeds shows it as added (PR-23).
export function withFollowed({ urls, ...feed }) {
  const followed = urls.find((url) => getFeedByUrl(url));
  return { ...feed, url: followed ?? feed.url, followed: Boolean(followed) };
}

const router = Router();

/**
 * POST /api/discover
 * Discover RSS/Atom feeds from a website URL.
 * Body: { url: string }
 */
router.post('/', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Website URL is required' });
  }

  try {
    const feeds = await discoverFeeds(url);
    res.json({ feeds: feeds.map(withFollowed) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
