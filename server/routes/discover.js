import { Router } from 'express';
import { discoverFeeds } from '../utils/feedDiscovery.js';

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
    res.json({ feeds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
