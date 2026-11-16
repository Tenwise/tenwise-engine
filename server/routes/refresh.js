import { Router } from 'express';
import { getFeed } from '../db/reader.js';
import { refreshFeed } from '../refresh/feedRefresh.js';
import { refresher } from '../refresh/autoRefresh.js';
import { feedIdsFrom } from './refreshInput.js';

const router = Router();

/** GET /api/refresh → { running, lastStartedAt, lastFinishedAt, lastInserted, lastFailed } */
router.get('/', (req, res) => {
  res.json(refresher.status());
});

/**
 * POST /api/refresh { feedIds? }. Without feedIds every feed is refreshed,
 * joining a scheduled run that is under way → { inserted, failed: [feed titles] }.
 * With them (new feeds from an OPML import or the welcome) → 202 { started, feeds }
 * at once: fetching a hundred feeds takes minutes, longer than a request should
 * wait (OPS-19). The run goes through the refresher, so GET shows its progress
 * and the app reloads when it finishes.
 */
router.post('/', async (req, res) => {
  try {
    const ids = feedIdsFrom(req.body);
    if (!ids) return res.json(await refresher.runAll());
    refresher.runFeeds(ids).catch((err) => console.error('Refreshing new feeds failed:', err));
    return res.status(202).json({ started: true, feeds: ids.length });
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
