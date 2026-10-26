import { Router } from 'express';
import { parseFeed } from '../utils/feedParser.js';

const router = Router();

/**
 * POST /api/feeds/parse
 * Parse a single RSS/Atom feed URL.
 * Body: { url: string }
 */
router.post('/parse', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Feed URL is required' });
  }

  try {
    const feed = await parseFeed(url);
    res.json(feed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
