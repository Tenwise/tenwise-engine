import { Router } from 'express';
import { muteCondition } from '../../shared/rules.js';
import {
  createFolder, listFolders, updateFolderById, removeFolderById, removeFolderAndFeedsById,
  findFolderByName,
  createFeed, listFeeds, listRemovedFeeds, getFeed, updateFeed, removeFeed,
  bulkInsertArticles, getArticleById, findArticleByLink, setArticleImage,
  updateArticle, bulkUpdateArticles, getArticlesByAiStatus,
  getQueueCount, resetProcessingToQueued, claimNextQueued, getCounts, clearAll,
  DB_PATH,
} from '../db/reader.js';
import { currentRules, feedAuthors, getArticlePage, markViewRead } from '../db/articlePages.js';
import { createAuthorGroup, deleteAuthorGroup, listAuthorGroups, setAuthorSettings, updateAuthorGroup } from '../db/authorGroups.js';
import { FILTER_KEYS } from '../../shared/aiFilters.js';
import { findPageImage } from '../utils/pageImage.js';

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

/** GET /feeds/:id/authors — the feed's authors, latest first: [{ author, total, unread }]. */
router.get('/feeds/:id/authors', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try { res.json(feedAuthors(id)); }
  catch (err) { sendDbError(res, err); }
});

// Sender groups (PR-26): the inbox feed's senders, organised in the sidebar.
const sendGroupError = (res, err) => (err.status ? res.status(err.status).json({ error: err.message }) : sendDbError(res, err));
const idParam = (req) => Number(req.params.id);

/** GET /feeds/:id/author-groups — { groups: [{ id, name, collapsed }], authors: [{ author, groupId, hidden }] }. */
router.get('/feeds/:id/author-groups', (req, res) => {
  const id = idParam(req);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try { res.json(listAuthorGroups(id)); }
  catch (err) { sendGroupError(res, err); }
});

/** POST /feeds/:id/author-groups { name } — a new group: { id, name, collapsed }. */
router.post('/feeds/:id/author-groups', (req, res) => {
  const id = idParam(req);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try { res.status(201).json(createAuthorGroup(id, req.body?.name)); }
  catch (err) { sendGroupError(res, err); }
});

/** PUT /author-groups/:id { name?, collapsed? } — renames or folds a group. */
router.put('/author-groups/:id', (req, res) => {
  const id = idParam(req);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const group = updateAuthorGroup(id, { name: req.body?.name, collapsed: req.body?.collapsed });
    return group ? res.json(group) : res.status(404).json({ error: 'Not found' });
  } catch (err) { return sendGroupError(res, err); }
});

/** DELETE /author-groups/:id — deletes a group; its senders become ungrouped. */
router.delete('/author-groups/:id', (req, res) => {
  const id = idParam(req);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try { return deleteAuthorGroup(id) ? res.json({ deleted: true }) : res.status(404).json({ error: 'Not found' }); }
  catch (err) { return sendGroupError(res, err); }
});

/** PUT /feeds/:id/author-settings { author, groupId?, hidden? } — a sender's group (null for none) or hidden flag. */
router.put('/feeds/:id/author-settings', (req, res) => {
  const id = idParam(req);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  const { author, groupId, hidden } = req.body ?? {};
  if (groupId !== undefined && groupId !== null && !Number.isInteger(groupId)) return res.status(400).json({ error: 'invalid groupId' });
  try { res.json(setAuthorSettings(id, author, { groupId, hidden: hidden === undefined ? undefined : Boolean(hidden) })); }
  catch (err) { sendGroupError(res, err); }
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
  try { res.json(getCounts(muteCondition(currentRules()))); }
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
const VIEWS = { all: false, today: false, saved: false, unsorted: false, feed: true, folder: true, collection: true, filter: true };
const text = (value) => (typeof value === 'string' ? value : '');

// An article's author is at most this long here; a longer one matches nothing anyway.
const MAX_AUTHOR = 300;

// A feed's narrowing: a group of its authors (PR-26) wins over one author.
function narrowing({ author, authorGroup }) {
  const group = Number(authorGroup);
  return authorGroup !== undefined && authorGroup !== '' && Number.isInteger(group) ? { group } : text(author).slice(0, MAX_AUTHOR);
}

// The view a request names, or null if it isn't one. A feed may be narrowed
// to one author, or to a group of them.
function viewOf({ view = 'all', id, author, authorGroup }) {
  if (!Object.hasOwn(VIEWS, view)) return null;
  const viewId = Number(id);
  const missingId = VIEWS[view] && !Number.isInteger(viewId);
  return missingId ? null : { view, id: viewId, author: view === 'feed' ? narrowing({ author, authorGroup }) : '' };
}

/** GET /articles/page?view&id&author|authorGroup&q&aiOnly=1&read=unread|read&after=<ISO>&sentiment=…&offset&limit — one page of a view. */
router.get('/articles/page', (req, res) => {
  const target = viewOf(req.query);
  if (!target) return res.status(400).json({ error: 'invalid view' });
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, text(req.query[key])]).filter(([, v]) => v));
  try {
    res.json(getArticlePage(target.view, target.id, {
      q: text(req.query.q).slice(0, 500),
      filters,
      aiOnly: req.query.aiOnly === '1',
      read: text(req.query.read),
      after: text(req.query.after),
      author: target.author,
      offset: Number(req.query.offset) || 0,
      limit: Number(req.query.limit) || undefined,
    }));
  } catch (err) { sendDbError(res, err); }
});

/** POST /articles/mark-view-read { view, id, author?, authorGroup? } — marks every unread article in the view read. */
router.post('/articles/mark-view-read', (req, res) => {
  const target = viewOf(req.body ?? {});
  if (!target) return res.status(400).json({ error: 'invalid view' });
  try { res.json({ changed: markViewRead(target.view, target.id, target.author) }); }
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

// Articles whose page had no picture, and when that was found: not asked again for a while.
const NO_IMAGE_FOR_MS = 6 * 60 * 60 * 1000;
const noImage = new Map();

const askedLately = (id) => Date.now() - (noImage.get(id) ?? -Infinity) < NO_IMAGE_FOR_MS;

// The article's picture: its own, else its page's (stored once found); null when none.
async function articleImage(article) {
  if (article.imageUrl) return article.imageUrl;
  if (!article.link || askedLately(article.id)) return null;
  const imageUrl = await findPageImage(article.link).catch(() => '');
  if (imageUrl) {
    setArticleImage(article.id, imageUrl);
    return imageUrl;
  }
  if (noImage.size >= 5000) noImage.clear();
  noImage.set(article.id, Date.now());
  return null;
}

/** GET /articles/:id/image → { imageUrl } — the feed's picture, else the page's preview image (UX-8), else null. */
router.get('/articles/:id/image', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const article = getArticleById(id);
    if (!article) return res.status(404).json({ error: 'Not found' });
    return res.json({ imageUrl: await articleImage(article) });
  } catch (err) { return sendDbError(res, err); }
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
