import { Router } from 'express';
import { getFeed, listFeeds } from '../db/reader.js';
import { refreshFeed, refreshFeeds } from '../refresh/feedRefresh.js';
import { refresher } from '../refresh/autoRefresh.js';
import { feedIdsFrom } from './refreshInput.js';

const router = Router();

/** GET /api/refresh → { running, lastStartedAt, lastFinishedAt, lastInserted, lastFailed } */
router.get('/', (req, res) => {
  res.json(refresher.status());
});

/**
 * POST /api/refresh { feedIds? } → { inserted, failed: [feed titles] }
 * Without feedIds every feed is refreshed, joining a scheduled run that is
 * under way; with them (new feeds from an OPML import), just those.
 */
router.post('/', async (req, res) => {
  try {
    const ids = feedIdsFrom(req.body);
    if (!ids) return res.json(await refresher.runAll());
    const wanted = new Set(ids);
    return res.json(await refreshFeeds(listFeeds().filter((f) => wanted.has(f.id))));
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
});

/** POST /api/refresh/feeds/:id → { inserted, failed, feed } */
router.post('/feeds/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const feed = getFeed(id);
    if (!feed || feed.removedAt) return res.status(404).json({ error: 'Not found' });
    return res.json(await refreshFeed(feed));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
