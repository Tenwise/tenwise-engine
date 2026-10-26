import { Router } from 'express';
import { extractArticle } from '../utils/articleExtractor.js';

const router = Router();

/**
 * POST /api/articles/extract
 * Extract full article content from a URL for the in-app reader.
 * Body: { url: string }
 */
router.post('/extract', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Article URL is required' });
  }

  try {
    const article = await extractArticle(url);
    res.json(article);
  } catch (error) {
    // reason and site say why, for the reader's note (articleExtractor.js).
    res.status(500).json({ error: error.message, reason: error.reason ?? 'failed', site: error.site ?? '' });
  }
});

export default router;
