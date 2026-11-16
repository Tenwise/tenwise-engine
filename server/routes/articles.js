import { Router } from 'express';
import { extractArticle } from '../utils/articleExtractor.js';
import { setResolvedLink } from '../db/reader.js';

const router = Router();

// A link a plugin resolved (Google News to the publisher) is kept for
// citations, whether or not the publisher's page let us read it (BRF-23).
const keepResolved = (url, resolvedUrl) => {
  if (resolvedUrl) setResolvedLink(url, resolvedUrl);
};

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
    keepResolved(url, article.resolvedUrl);
    res.json(article);
  } catch (error) {
    keepResolved(url, error.resolvedUrl);
    // reason and site say why, for the reader's note (articleExtractor.js).
    res.status(500).json({ error: error.message, reason: error.reason ?? 'failed', site: error.site ?? '' });
  }
});

export default router;
