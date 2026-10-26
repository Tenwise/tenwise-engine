import { Router } from 'express';
import {
  createFolder, listFolders, updateFolderById, removeFolderById, removeFolderAndFeedsById,
  findFolderByName,
  createFeed, listFeeds, listRemovedFeeds, getFeed, updateFeed, removeFeed,
  bulkInsertArticles, getArticleById, findArticleByLink,
  updateArticle, bulkUpdateArticles, getArticlesByAiStatus,
  getQueueCount, resetProcessingToQueued, claimNextQueued, getCounts, clearAll,
  DB_PATH,
} from '../db/reader.js';
import { getArticlePage, markViewRead } from '../db/articlePages.js';
import { FILTER_KEYS } from '../../shared/aiFilters.js';

const router = Router();

// A reference to a feed or folder that doesn't exist (deleted meanwhile, or a
// bad id) is the client's mistake, not a server error.
function sendDbError(res, err) {
  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return res.status(404).json({ error: 'Feed or folder not found' });
  return res.status(500).json({ error: err.message });
}

// ── Folders ───────────────────────────────────────────────────────────────────

router.get('/folders', (req, res) => {
  try { res.json(listFolders()); }
  catch (err) { sendDbError(res, err); }
});

router.post('/folders', (req, res) => {
  const { name, order } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try { res.status(201).json(createFolder({ name: name.trim(), order })); }
  catch (err) { sendDbError(res, err); }
});

// Find-or-create a folder by name (used by OPML import)
router.post('/folders/find-or-create', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const existing = findFolderByName(name.trim());
    if (existing) return res.json(existing);
    res.status(201).json(createFolder({ name: name.trim() }));
  } catch (err) { sendDbError(res, err); }
});

router.put('/folders/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const updated = updateFolderById(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) { sendDbError(res, err); }
});

router.delete('/folders/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    if (req.query.withFeeds === 'true') return res.json({ ok: true, keptSaved: removeFolderAndFeedsById(id) });
    removeFolderById(id);
    return res.json({ ok: true, keptSaved: 0 });
  } catch (err) { return sendDbError(res, err); }
});

// ── Feeds ─────────────────────────────────────────────────────────────────────

router.get('/feeds', (req, res) => {
  try {
    if (req.query.removed === '1') return res.json(listRemovedFeeds());
    const folderId = req.query.folder_id !== undefined ? Number(req.query.folder_id) : undefined;
    return res.json(listFeeds(folderId));
  } catch (err) { return sendDbError(res, err); }
});

router.get('/feeds/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const feed = getFeed(id);
    if (!feed) return res.status(404).json({ error: 'Not found' });
    res.json(feed);
  } catch (err) { sendDbError(res, err); }
});

router.post('/feeds', (req, res) => {
  const { url } = req.body;
  if (!url?.trim()) return res.status(400).json({ error: 'url is required' });
  try { res.status(201).json(createFeed(req.body)); }
  catch (err) {
    if (err.message === 'Feed already exists') return res.status(409).json({ error: err.message });
    sendDbError(res, err);
  }
});

router.put('/feeds/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const updated = updateFeed(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) { sendDbError(res, err); }
});

router.delete('/feeds/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try { res.json({ ok: true, keptSaved: removeFeed(id) }); }
  catch (err) { sendDbError(res, err); }
});

// ── Articles ──────────────────────────────────────────────────────────────────

// These specific routes must come before /:id

router.get('/articles/counts', (req, res) => {
  try { res.json(getCounts()); }
  catch (err) { sendDbError(res, err); }
});

router.get('/articles/queue-count', (req, res) => {
  try { res.json({ count: getQueueCount() }); }
  catch (err) { sendDbError(res, err); }
});

router.get('/articles/by-ai-status', (req, res) => {
  const { status } = req.query;
  if (!status) return res.status(400).json({ error: 'status is required' });
  try { res.json(getArticlesByAiStatus(status.split(','))); }
  catch (err) { sendDbError(res, err); }
});

router.get('/articles/by-link', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url is required' });
  try {
    const article = findArticleByLink(url);
    if (!article) return res.status(404).json({ error: 'Not found' });
    res.json(article);
  } catch (err) { sendDbError(res, err); }
});

// Each view, and whether it needs the id of a feed or folder.
const VIEWS = { all: false, today: false, saved: false, unsorted: false, feed: true, folder: true, collection: true };
const text = (value) => (typeof value === 'string' ? value : '');

// The view a request names, or null if it isn't one.
function viewOf({ view = 'all', id }) {
  if (!Object.hasOwn(VIEWS, view)) return null;
  const viewId = Number(id);
  const missingId = VIEWS[view] && !Number.isInteger(viewId);
  return missingId ? null : { view, id: viewId };
}

/** GET /articles/page?view&id&q&aiOnly=1&sentiment=…&offset&limit — one page of a view. */
router.get('/articles/page', (req, res) => {
  const target = viewOf(req.query);
  if (!target) return res.status(400).json({ error: 'invalid view' });
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, text(req.query[key])]).filter(([, v]) => v));
  try {
    res.json(getArticlePage(target.view, target.id, {
      q: text(req.query.q).slice(0, 500),
      filters,
      aiOnly: req.query.aiOnly === '1',
      offset: Number(req.query.offset) || 0,
      limit: Number(req.query.limit) || undefined,
    }));
  } catch (err) { sendDbError(res, err); }
});

/** POST /articles/mark-view-read { view, id } — marks every unread article in the view read. */
router.post('/articles/mark-view-read', (req, res) => {
  const target = viewOf(req.body ?? {});
  if (!target) return res.status(400).json({ error: 'invalid view' });
  try { res.json({ changed: markViewRead(target.view, target.id) }); }
  catch (err) { sendDbError(res, err); }
});

router.get('/articles/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const article = getArticleById(id);
    if (!article) return res.status(404).json({ error: 'Not found' });
    res.json(article);
  } catch (err) { sendDbError(res, err); }
});

router.post('/articles/bulk-insert', (req, res) => {
  const { feedId, articles } = req.body;
  if (!feedId || !Array.isArray(articles)) {
    return res.status(400).json({ error: 'feedId and articles[] are required' });
  }
  try { res.status(201).json({ inserted: bulkInsertArticles(feedId, articles) }); }
  catch (err) { sendDbError(res, err); }
});

router.put('/articles/bulk-update', (req, res) => {
  const { ids, ...fields } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids[] is required' });
  }
  try { bulkUpdateArticles(ids, fields); res.json({ ok: true }); }
  catch (err) { sendDbError(res, err); }
});

router.post('/articles/claim-next', (req, res) => {
  try { res.json(claimNextQueued()); }
  catch (err) { sendDbError(res, err); }
});

router.post('/articles/reset-processing', (req, res) => {
  try { resetProcessingToQueued(); res.json({ ok: true }); }
  catch (err) { sendDbError(res, err); }
});

router.put('/articles/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const updated = updateArticle(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) { sendDbError(res, err); }
});

// ── Misc ──────────────────────────────────────────────────────────────────────

router.delete('/all', (req, res) => {
  try { clearAll(); res.json({ ok: true }); }
  catch (err) { sendDbError(res, err); }
});

router.get('/db-path', (req, res) => {
  res.json({ path: DB_PATH });
});

export default router;
