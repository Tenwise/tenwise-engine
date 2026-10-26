import { db, DB_PATH } from './database.js';
import { makeExcerpt, searchText, tokenizeQuery } from '../utils/text.js';
import { itemGuid, normalizeDate } from '../utils/articleFields.js';

export { DB_PATH };

// ── Row mappers (DB snake_case → client camelCase) ────────────────────────────

function toFolder(row) {
  return { id: row.id, name: row.name, order: row.sort_order, createdAt: row.created_at };
}

function toFeed(row) {
  return {
    id: row.id,
    folderId: row.folder_id,
    title: row.title,
    url: row.url,
    siteUrl: row.site_url,
    favicon: row.favicon,
    description: row.description,
    lastRefreshed: row.last_refreshed,
    lastError: row.last_error ?? null,
    lastErrorAt: row.last_error_at ?? null,
    removedAt: row.removed_at ?? null,
    createdAt: row.created_at,
  };
}

function toArticle(row) {
  return {
    id: row.id,
    feedId: row.feed_id,
    guid: row.guid,
    title: row.title,
    link: row.link,
    canonicalLink: row.canonical_link,
    publishedAt: row.published_at,
    isRead: row.is_read,
    isBookmarked: row.is_bookmarked,
    savedAt: row.saved_at ?? null,
    note: row.note ?? null,
    content: row.content,
    summary: row.summary,
    author: row.author,
    imageUrl: row.image_url,
    description: row.description,
    aiStatus: row.ai_status,
    aiSummary: row.ai_summary,
    aiSummarySource: row.ai_summary_source ?? null,
    aiAnalysis: row.ai_analysis,
    favicon: row.favicon,
    createdAt: row.created_at,
    excerpt: row.excerpt,
  };
}

// List views carry only what the list shows: no content/summary/description
// (clients fetch the full article, GET /articles/:id, when it is opened), no
// guid/canonical link/created-at/favicon (the list uses the feed's favicon),
// and the excerpt cut to what a preview line can show.
export const LIST_EXCERPT_CHARS = 200;
export const LIST_COLUMNS = `id, feed_id, title, link, published_at, is_read, is_bookmarked, saved_at, note, author,
  image_url, ai_status, ai_summary, ai_summary_source, ai_analysis, substr(excerpt, 1, ${LIST_EXCERPT_CHARS}) AS excerpt`;

export function toListItem(row) {
  const { content: _content, summary: _summary, description: _description, ...item } = toArticle(row);
  return item;
}

/** SQL condition: the article's feed is subscribed (not removed and kept for its saves). */
export const FROM_ACTIVE_FEED = 'feed_id IN (SELECT id FROM feeds WHERE removed_at IS NULL)';

// ── Folders ───────────────────────────────────────────────────────────────────

const stmts = {
  insertFolder: db.prepare(
    `INSERT INTO folders (name, sort_order, created_at) VALUES (@name, @sort_order, @created_at)`
  ),
  updateFolder: db.prepare(
    `UPDATE folders SET name = @name, sort_order = @sort_order WHERE id = @id`
  ),
  deleteFolder: db.prepare(`DELETE FROM folders WHERE id = ?`),
  getAllFolders: db.prepare(`SELECT * FROM folders ORDER BY sort_order, id`),
  getFolderById: db.prepare(`SELECT * FROM folders WHERE id = ?`),
  getFolderByName: db.prepare(`SELECT * FROM folders WHERE name = ?`),
  maxFolderOrder: db.prepare(`SELECT COALESCE(MAX(sort_order), 0) AS m FROM folders`),
  unlinkFolderFeeds: db.prepare(`UPDATE feeds SET folder_id = NULL WHERE folder_id = ?`),
  getFeedsByFolder: db.prepare(`SELECT id FROM feeds WHERE folder_id = ?`),

  insertFeed: db.prepare(
    `INSERT INTO feeds (folder_id, title, url, site_url, favicon, description, last_refreshed, created_at)
     VALUES (@folder_id, @title, @url, @site_url, @favicon, @description, @last_refreshed, @created_at)`
  ),
  updateFeed: db.prepare(
    `UPDATE feeds SET folder_id = @folder_id, title = @title, site_url = @site_url,
     favicon = @favicon, description = @description, last_refreshed = @last_refreshed,
     last_error = @last_error, last_error_at = @last_error_at WHERE id = @id`
  ),
  deleteFeed: db.prepare(`DELETE FROM feeds WHERE id = ?`),
  getAllFeeds: db.prepare(`SELECT * FROM feeds WHERE removed_at IS NULL ORDER BY id`),
  getRemovedFeeds: db.prepare(`SELECT * FROM feeds WHERE removed_at IS NOT NULL ORDER BY id`),
  deleteUnsavedByFeed: db.prepare(`DELETE FROM articles WHERE feed_id = ? AND is_bookmarked = 0`),
  countByFeed: db.prepare(`SELECT COUNT(*) AS n FROM articles WHERE feed_id = ?`),
  retireFeed: db.prepare(
    `UPDATE feeds SET removed_at = ?, folder_id = NULL, last_error = NULL, last_error_at = NULL WHERE id = ?`
  ),
  reviveFeed: db.prepare(
    `UPDATE feeds SET removed_at = NULL, folder_id = @folder_id, title = @title, site_url = COALESCE(@site_url, site_url),
     favicon = COALESCE(@favicon, favicon), description = COALESCE(@description, description) WHERE id = @id`
  ),
  getFeedById: db.prepare(`SELECT * FROM feeds WHERE id = ?`),
  getFeedByUrl: db.prepare(`SELECT * FROM feeds WHERE url = ?`),
  getFeedsByFolderId: db.prepare(`SELECT * FROM feeds WHERE folder_id = ? AND removed_at IS NULL`),
  deleteArticlesByFeed: db.prepare(`DELETE FROM articles WHERE feed_id = ?`),
  deleteArticlesByFeedList: (ids) =>
    db.prepare(`DELETE FROM articles WHERE feed_id IN (${ids.map(() => '?').join(',')})`),

  getArticleById: db.prepare(`SELECT * FROM articles WHERE id = ?`),
  getSummarySource: db.prepare(`SELECT ai_summary_source FROM articles WHERE id = ?`),
  getArticleByLink: db.prepare(`SELECT * FROM articles WHERE link = ? LIMIT 1`),
  getUnreadByFeed: db.prepare(
    `SELECT feed_id, COUNT(*) AS cnt FROM articles
     WHERE is_read = 0 AND feed_id IN (SELECT id FROM feeds WHERE removed_at IS NULL) GROUP BY feed_id`
  ),
  getSavedCount: db.prepare(`SELECT COUNT(*) AS cnt FROM articles WHERE is_bookmarked = 1`),
  getUnsortedCount: db.prepare(
    `SELECT COUNT(*) AS cnt FROM articles WHERE is_bookmarked = 1 AND id NOT IN (SELECT article_id FROM collection_items)`
  ),
  getQueueCount: db.prepare(`SELECT COUNT(*) AS cnt FROM articles WHERE ai_status = 'queued'`),
  clearArticles: db.prepare(`DELETE FROM articles`),
  clearFeeds: db.prepare(`DELETE FROM feeds`),
  clearFolders: db.prepare(`DELETE FROM folders`),
};

// ── Folder operations ─────────────────────────────────────────────────────────

export function createFolder(data) {
  const maxRow = stmts.maxFolderOrder.get();
  const order = data.order ?? (maxRow.m + 1);
  const info = stmts.insertFolder.run({
    name: data.name,
    sort_order: order,
    created_at: new Date().toISOString(),
  });
  return toFolder(stmts.getFolderById.get(info.lastInsertRowid));
}

export function listFolders() {
  return stmts.getAllFolders.all().map(toFolder);
}

export function updateFolderById(id, data) {
  const row = stmts.getFolderById.get(id);
  if (!row) return null;
  stmts.updateFolder.run({ id, name: data.name ?? row.name, sort_order: data.order ?? row.sort_order });
  return toFolder(stmts.getFolderById.get(id));
}

export function removeFolderById(id) {
  stmts.unlinkFolderFeeds.run(id);
  return stmts.deleteFolder.run(id).changes > 0;
}

/** Deletes a folder and its feeds (keeping their saves, see removeFeed); returns how many saves were kept. */
export function removeFolderAndFeedsById(id) {
  return db.transaction(() => {
    const feedIds = stmts.getFeedsByFolder.all(id).map(f => f.id);
    const kept = feedIds.reduce((sum, feedId) => sum + retireOrDeleteFeed(feedId), 0);
    stmts.deleteFolder.run(id);
    return kept;
  })();
}

export function findFolderByName(name) {
  const row = stmts.getFolderByName.get(name);
  return row ? toFolder(row) : null;
}

// ── Feed operations ───────────────────────────────────────────────────────────

// Subscribing again to a removed feed brings it back (same id, so its kept
// saves and the articles it already has line up with new ones).
function reviveFeed(row, data) {
  stmts.reviveFeed.run({
    id: row.id,
    folder_id: data.folderId ?? null,
    title: data.title ?? row.title,
    site_url: data.siteUrl ?? null,
    favicon: data.favicon ?? null,
    description: data.description ?? null,
  });
  return toFeed(stmts.getFeedById.get(row.id));
}

export function createFeed(data) {
  const existing = stmts.getFeedByUrl.get(data.url);
  if (existing?.removed_at) return reviveFeed(existing, data);
  if (existing) throw new Error('Feed already exists');
  const info = stmts.insertFeed.run({
    folder_id: data.folderId ?? null,
    title: data.title,
    url: data.url,
    site_url: data.siteUrl ?? null,
    favicon: data.favicon ?? null,
    description: data.description ?? null,
    last_refreshed: data.lastRefreshed ?? null,
    created_at: new Date().toISOString(),
  });
  return toFeed(stmts.getFeedById.get(info.lastInsertRowid));
}

/** Removed feeds kept for their saved articles (their names label those saves). */
export function listRemovedFeeds() {
  return stmts.getRemovedFeeds.all().map(toFeed);
}

export function listFeeds(folderId) {
  if (folderId !== undefined) return stmts.getFeedsByFolderId.all(folderId).map(toFeed);
  return stmts.getAllFeeds.all().map(toFeed);
}

export function getFeed(id) {
  const row = stmts.getFeedById.get(id);
  return row ? toFeed(row) : null;
}

export function getFeedByUrl(url) {
  const row = stmts.getFeedByUrl.get(url);
  return row ? toFeed(row) : null;
}

// A field's new value: the given one, or the current one when not given.
// orKeep treats null as "not given"; setOrKeep lets null clear the field.
const orKeep = (value, current) => value ?? current;
const setOrKeep = (value, current) => (value !== undefined ? value : current);

export function updateFeed(id, data) {
  const row = stmts.getFeedById.get(id);
  if (!row) return null;
  stmts.updateFeed.run({
    id,
    folder_id: setOrKeep(data.folderId, row.folder_id) ?? null,
    title: orKeep(data.title, row.title),
    site_url: orKeep(data.siteUrl, row.site_url),
    favicon: orKeep(data.favicon, row.favicon),
    description: orKeep(data.description, row.description),
    last_refreshed: orKeep(data.lastRefreshed, row.last_refreshed),
    last_error: setOrKeep(data.lastError, row.last_error),
    last_error_at: setOrKeep(data.lastErrorAt, row.last_error_at),
  });
  return toFeed(stmts.getFeedById.get(id));
}

// Deletes the feed's unsaved articles. With saves left, the feed is kept,
// marked removed (hidden from the sidebar, refresh and All/Today), so the
// saves keep their notes, collections and source; without, it is deleted.
// Returns how many saves were kept.
function retireOrDeleteFeed(id) {
  stmts.deleteUnsavedByFeed.run(id);
  const kept = stmts.countByFeed.get(id).n;
  if (kept > 0) stmts.retireFeed.run(new Date().toISOString(), id);
  else stmts.deleteFeed.run(id);
  return kept;
}

/** Removes a feed and its articles, except saved ones; returns how many saves were kept. */
export function removeFeed(id) {
  return db.transaction(() => retireOrDeleteFeed(id))();
}

// ── Article operations ────────────────────────────────────────────────────────

// SQLite only accepts numbers, strings, bigints, buffers, and null. RSS
// parsers can return Date objects, arrays, or nested objects, so coerce.
function toSqlText(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function existingCanonicalLinks(links) {
  if (links.length === 0) return new Set();
  const placeholders = links.map(() => '?').join(',');
  return new Set(
    db.prepare(`SELECT canonical_link FROM articles WHERE canonical_link IN (${placeholders})`)
      .all(...links).map(r => r.canonical_link)
  );
}

// Keeps the first item for each key; items without a key are all kept.
function firstPerKey(items, keyOf) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyOf(item);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Items not already stored: by guid within the feed, then by canonical link
// anywhere. Duplicates within the batch itself are dropped the same way.
function unseenItems(feedId, items) {
  const existingGuids = new Set(
    db.prepare(`SELECT guid FROM articles WHERE feed_id = ?`).all(feedId).map(r => r.guid)
  );
  const batch = firstPerKey(firstPerKey(items, itemGuid), (a) => a.canonicalLink);
  const candidates = batch.filter(a => !existingGuids.has(itemGuid(a)));
  const known = existingCanonicalLinks(candidates.map(a => a.canonicalLink).filter(Boolean));
  return candidates.filter(a => !a.canonicalLink || !known.has(a.canonicalLink));
}

function articleRow(feedId, a, now) {
  const summary = toSqlText(a.summary);
  const content = toSqlText(a.content);
  return {
    feed_id: feedId,
    guid: itemGuid(a),
    title: toSqlText(a.title),
    link: toSqlText(a.link),
    canonical_link: toSqlText(a.canonicalLink),
    published_at: normalizeDate(toSqlText(a.publishedAt), now),
    content,
    summary,
    author: toSqlText(a.author),
    image_url: toSqlText(a.imageUrl),
    description: toSqlText(a.description),
    favicon: null,
    created_at: now,
    excerpt: makeExcerpt(summary, content),
  };
}

const insertArticle = db.prepare(
  `INSERT OR IGNORE INTO articles
     (feed_id, guid, title, link, canonical_link, published_at, is_read, is_bookmarked,
      content, summary, author, image_url, description, ai_status, favicon, created_at, excerpt)
   VALUES
     (@feed_id, @guid, @title, @link, @canonical_link, @published_at, 0, 0,
      @content, @summary, @author, @image_url, @description, 'none', @favicon, @created_at, @excerpt)`
);
const indexArticle = db.prepare(`INSERT INTO articles_fts (rowid, body) VALUES (?, ?)`);

/** Stores new items for a feed and indexes them for search; returns how many were added. */
export function bulkInsertArticles(feedId, items) {
  const toInsert = items.length === 0 ? [] : unseenItems(feedId, items);
  if (toInsert.length === 0) return 0;

  const now = new Date().toISOString();
  let count = 0;
  db.transaction(() => {
    for (const a of toInsert) {
      const row = articleRow(feedId, a, now);
      const info = insertArticle.run(row);
      if (info.changes > 0) {
        indexArticle.run(info.lastInsertRowid, searchText(row.summary, row.content));
        count++;
      }
    }
  })();
  return count;
}

// List view of articles (no full content). view: all | feed | folder | saved | today
// FTS5 query for one search term: phrases match exactly, single words also
// match as prefixes ("cloud" finds "clouds"). Quotes are escaped by doubling.
function ftsTerm(token) {
  const quoted = `"${token.replace(/"/g, '""')}"`;
  return token.includes(' ') ? quoted : `${quoted}*`;
}

const stmtSearchTerm = db.prepare(`SELECT rowid AS id FROM articles_fts WHERE articles_fts MATCH ?`);

/**
 * Full-text body search. Returns the query terms and, aligned by index, the
 * ids of articles whose body contains each term — callers combine these with
 * title/source/topic matches. (Arrays, not an object keyed by user input, so
 * a term like "__proto__" can't touch object prototypes.)
 */
export function searchArticleBodies(query) {
  const tokens = tokenizeQuery(query).slice(0, 10);
  const matches = tokens.map((token) => stmtSearchTerm.all(ftsTerm(token)).map((r) => r.id));
  return { tokens, matches };
}

export function getArticleById(id) {
  const row = stmts.getArticleById.get(id);
  return row ? toArticle(row) : null;
}

export function findArticleByLink(link) {
  const row = stmts.getArticleByLink.get(link);
  return row ? toArticle(row) : null;
}

// Read/bookmark flags arrive as 0/1 or true/false; SQLite can't bind booleans.
const flag = (value) => (value ? 1 : 0);
const same = (value) => value;
// A note is trimmed text; an empty one is no note.
const NOTE_MAX_CHARS = 2000;
const noteText = (value) => (typeof value === 'string' && value.trim().slice(0, NOTE_MAX_CHARS)) || null;
// Who wrote a summary: 'manual' (asked for in the reader) or 'batch'.
const SUMMARY_SOURCES = new Set(['manual', 'batch']);
const summarySource = (value) => (SUMMARY_SOURCES.has(value) ? value : null);
const BULK_CHUNK = 10000;

// Fields a change can set: [client key, column, conversion].
const ARTICLE_FIELDS = [
  ['isRead', 'is_read', flag],
  ['aiStatus', 'ai_status', same],
  ['aiSummary', 'ai_summary', same],
  ['aiSummarySource', 'ai_summary_source', summarySource],
  ['aiAnalysis', 'ai_analysis', same],
  ['note', 'note', noteText],
];

// Whether a change saves (true) or unsaves (false) the article, or neither
// (undefined). Writing a note saves the article: one gesture, not two.
function saveChange(data) {
  if (data.isBookmarked !== undefined) return Boolean(flag(data.isBookmarked));
  return noteText(data.note) ? true : undefined;
}

/**
 * SET clauses and parameters for a change, limited to `keys`. Saving stamps
 * saved_at once (saving again keeps the first time); unsaving clears it, and
 * `unsave` tells the caller to take the article out of its collections.
 */
function articleChanges(data, keys) {
  const fields = [];
  const values = {};
  for (const [key, column, convert] of ARTICLE_FIELDS) {
    if (!keys.includes(key) || data[key] === undefined) continue;
    fields.push(`${column} = @${column}`);
    values[column] = convert(data[key]);
  }
  const save = keys.includes('isBookmarked') ? saveChange(data) : undefined;
  if (save === true) {
    fields.push('is_bookmarked = 1', 'saved_at = COALESCE(saved_at, @now)');
    values.now = new Date().toISOString();
  } else if (save === false) {
    fields.push('is_bookmarked = 0', 'saved_at = NULL');
  }
  return { fields, values, unsave: save === false };
}

// A collection holds saved articles only, so unsaving takes them out.
const leaveCollections = (ids) => db.prepare(
  `DELETE FROM collection_items WHERE article_id IN (${ids.map(() => '?').join(',')})`
).run(...ids);

const SINGLE_KEYS = ['isRead', 'isBookmarked', 'aiStatus', 'aiSummary', 'aiSummarySource', 'aiAnalysis', 'note'];
const BULK_KEYS = ['isRead', 'isBookmarked', 'aiStatus'];

// A summary the reader asked for is theirs: only another manual summary
// replaces it, so a batch result (even one already running) leaves it alone.
function keepManualSummary(id, data) {
  if (data.aiSummary === undefined || data.aiSummarySource === 'manual') return data;
  if (stmts.getSummarySource.get(id)?.ai_summary_source !== 'manual') return data;
  const { aiSummary: _summary, aiSummarySource: _source, ...rest } = data;
  return rest;
}

export function updateArticle(id, data) {
  const { fields, values, unsave } = articleChanges(keepManualSummary(id, data), SINGLE_KEYS);
  if (fields.length === 0) return getArticleById(id);
  db.transaction(() => {
    db.prepare(`UPDATE articles SET ${fields.join(', ')} WHERE id = @id`).run({ ...values, id });
    if (unsave) leaveCollections([id]);
  })();
  return getArticleById(id);
}

export function bulkUpdateArticles(ids, data) {
  if (ids.length === 0) return;
  const { fields, values, unsave } = articleChanges(data, BULK_KEYS);
  if (fields.length === 0) return;
  // SQLite allows 32,766 bound variables per statement, so "mark all read" on
  // a large library is split into chunks, all in one transaction.
  db.transaction(() => {
    for (let i = 0; i < ids.length; i += BULK_CHUNK) {
      const chunk = ids.slice(i, i + BULK_CHUNK);
      const placeholders = chunk.map((_, j) => `@id${j}`).join(',');
      const params = { ...values, ...Object.fromEntries(chunk.map((id, j) => [`id${j}`, id])) };
      db.prepare(`UPDATE articles SET ${fields.join(', ')} WHERE id IN (${placeholders})`).run(params);
      if (unsave) leaveCollections(chunk);
    }
  })();
}

export function getArticlesByAiStatus(statuses) {
  const arr = Array.isArray(statuses) ? statuses : [statuses];
  const placeholders = arr.map(() => '?').join(',');
  return db.prepare(
    `SELECT * FROM articles WHERE ai_status IN (${placeholders}) ORDER BY published_at DESC`
  ).all(...arr).map(toArticle);
}

export function getUnprocessedForFeed(feedId, limit) {
  return db.prepare(
    `SELECT * FROM articles WHERE feed_id = ? AND (ai_status IS NULL OR ai_status = 'none')
     ORDER BY published_at DESC LIMIT ?`
  ).all(feedId, limit).map(toArticle);
}

export function getQueueCount() {
  return stmts.getQueueCount.get().cnt;
}

// When each 'processing' article was claimed (in memory: after a server
// restart every claim is gone, so every 'processing' article is stale).
const claims = new Map();
const CLAIM_STALE_MS = 10 * 60 * 1000;

const claimStmts = {
  nextQueued: db.prepare(`SELECT * FROM articles WHERE ai_status = 'queued' ORDER BY published_at DESC LIMIT 1`),
  markProcessing: db.prepare(`UPDATE articles SET ai_status = 'processing' WHERE id = ?`),
  processingIds: db.prepare(`SELECT id FROM articles WHERE ai_status = 'processing'`),
  requeue: db.prepare(`UPDATE articles SET ai_status = 'queued' WHERE id = ? AND ai_status = 'processing'`),
};

/**
 * Hands the newest queued article to one caller and marks it processing, in
 * one step, so two open tabs never process the same article. Resolves to
 * { article, queued } (queued = how many were waiting), or { article: null }.
 */
export function claimNextQueued(now = Date.now()) {
  return db.transaction(() => {
    const row = claimStmts.nextQueued.get();
    if (!row) return { article: null, queued: 0 };
    const queued = stmts.getQueueCount.get().cnt;
    claimStmts.markProcessing.run(row.id);
    claims.set(row.id, now);
    return { article: toArticle({ ...row, ai_status: 'processing' }), queued };
  })();
}

const isStale = (id, now) => now - (claims.get(id) ?? 0) > CLAIM_STALE_MS;

/**
 * Puts articles left 'processing' back in the queue, but only stale ones (a
 * crashed or closed tab), not those another open tab is working on now.
 */
export function resetProcessingToQueued(now = Date.now()) {
  db.transaction(() => {
    for (const { id } of claimStmts.processingIds.all()) {
      if (!isStale(id, now)) continue;
      claimStmts.requeue.run(id);
      claims.delete(id);
    }
  })();
}

export function getCounts() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const unreadRows = stmts.getUnreadByFeed.all();
  const unreadByFeed = {};
  let total = 0;
  for (const r of unreadRows) { unreadByFeed[r.feed_id] = r.cnt; total += r.cnt; }
  const savedCount = stmts.getSavedCount.get().cnt;
  const unsortedCount = stmts.getUnsortedCount.get().cnt;
  const todayCount = db.prepare(
    `SELECT COUNT(*) AS cnt FROM articles WHERE published_at >= ? AND ${FROM_ACTIVE_FEED}`
  ).get(start.toISOString()).cnt;
  return { unreadByFeed, total, savedCount, unsortedCount, todayCount };
}

export function clearAll() {
  db.transaction(() => {
    stmts.clearArticles.run();
    stmts.clearFeeds.run();
    stmts.clearFolders.run();
  })();
}

// ── Favicon cache ─────────────────────────────────────────────────────────────

const faviconStmts = {
  get: db.prepare('SELECT type, body, fetched_at FROM favicons WHERE host = ?'),
  put: db.prepare(
    `INSERT INTO favicons (host, type, body, fetched_at) VALUES (@host, @type, @body, @fetchedAt)
     ON CONFLICT(host) DO UPDATE SET type = excluded.type, body = excluded.body, fetched_at = excluded.fetched_at`
  ),
};

/** The cached icon for a host: { type, body, fetchedAt }, type null when the site has none. */
export function getCachedFavicon(host) {
  const row = faviconStmts.get.get(host);
  return row && { type: row.type, body: row.body, fetchedAt: row.fetched_at };
}

export function saveCachedFavicon(host, icon) {
  faviconStmts.put.run({ host, type: icon?.type ?? null, body: icon?.body ?? null, fetchedAt: new Date().toISOString() });
}
