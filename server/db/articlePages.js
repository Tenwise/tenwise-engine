import { db } from './database.js';
import { FROM_ACTIVE_FEED, LIST_COLUMNS, searchArticleBodies, toListItem } from './reader.js';
import { FILTER_KEYS, applyFilters, availableFilters } from '../../shared/aiFilters.js';
import { rankArticles, tokenizeQuery } from '../../shared/search.js';

// The article list, one page at a time: the view, narrowed by search and the
// AI filters, with the counts and filter values the list header needs.

export const MAX_PAGE_SIZE = 500;
const DEFAULT_PAGE_SIZE = 150;

const startOfToday = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
};

// SQL condition (and its parameters) for the articles in a view.
function viewWhere(view, id) {
  switch (view) {
    case 'feed': return { sql: 'feed_id = ?', params: [id] };
    case 'folder': return { sql: 'feed_id IN (SELECT id FROM feeds WHERE folder_id = ?)', params: [id] };
    case 'saved': return { sql: 'is_bookmarked = 1', params: [] };
    case 'unsorted': return { sql: 'is_bookmarked = 1 AND id NOT IN (SELECT article_id FROM collection_items)', params: [] };
    case 'collection': return { sql: 'id IN (SELECT article_id FROM collection_items WHERE collection_id = ?)', params: [id] };
    // All and Today show subscribed feeds; saves from removed feeds stay in the save lists.
    case 'today': return { sql: `published_at >= ? AND ${FROM_ACTIVE_FEED}`, params: [startOfToday()] };
    default: return { sql: FROM_ACTIVE_FEED, params: [] };
  }
}

// One aiAnalysis value; NULL (never an error) when the JSON is malformed.
const analysisField = (key) => `(CASE WHEN json_valid(ai_analysis) THEN json_extract(ai_analysis, '$.${key}') END)`;

// The view's condition plus the AI-only toggle and the active filters.
function filteredWhere(where, { filters, aiOnly }) {
  const parts = [where.sql];
  const params = [...where.params];
  if (aiOnly) parts.push("ai_status = 'done'");
  for (const key of FILTER_KEYS) {
    if (!filters[key]) continue;
    parts.push(`${analysisField(key)} = ?`);
    params.push(filters[key]);
  }
  return { sql: parts.join(' AND '), params };
}

const count = (where) => db.prepare(`SELECT COUNT(*) AS n FROM articles WHERE ${where.sql}`).get(...where.params).n;

// Filter values present among the view's analysed articles: { sentiment: ['positive'], … }.
function viewFacets(where) {
  const rows = db.prepare(`SELECT ai_analysis FROM articles WHERE ${where.sql} AND ai_analysis IS NOT NULL`).all(...where.params);
  return availableFilters(rows.map((r) => ({ aiAnalysis: r.ai_analysis })));
}

const facetsToArrays = (facets) => Object.fromEntries(Object.entries(facets).map(([k, set]) => [k, [...set]]));

// Saved articles list in the order they were saved; the rest by publication.
const SAVE_ORDERED = new Set(['saved', 'unsorted', 'collection']);
const orderOf = (view) => (SAVE_ORDERED.has(view) ? 'saved_at DESC, id DESC' : 'published_at DESC, id DESC');

// Newest first, filtered in SQL.
function browsePage(where, options) {
  const filtered = filteredWhere(where, options);
  const rows = db.prepare(
    `SELECT ${LIST_COLUMNS} FROM articles WHERE ${filtered.sql} ORDER BY ${orderOf(options.view)} LIMIT ? OFFSET ?`
  ).all(...filtered.params, options.limit, options.offset);
  return { articles: rows.map(toListItem), total: count(filtered), facets: viewFacets(where) };
}

// Ranked by relevance (title › source › topics › body), then filtered.
function searchPage(where, tokens, options) {
  const candidates = db.prepare(`SELECT ${LIST_COLUMNS} FROM articles WHERE ${where.sql}`).all(...where.params).map(toListItem);
  const feedTitles = new Map(db.prepare('SELECT id, title FROM feeds').all().map((f) => [f.id, f.title]));
  const { tokens: bodyTokens, matches } = searchArticleBodies(options.q);
  const bodyMatches = new Map(bodyTokens.map((term, i) => [term, new Set(matches[i])]));
  const ranked = rankArticles(candidates, tokens, { sourceOf: (a) => feedTitles.get(a.feedId), bodyMatches });
  const filtered = applyFilters(ranked, { activeFilters: options.filters, aiOnly: options.aiOnly });
  return {
    articles: filtered.slice(options.offset, options.offset + options.limit),
    total: filtered.length,
    facets: availableFilters(ranked),
  };
}

const clamp = (n, min, max, fallback) => (Number.isInteger(n) ? Math.min(Math.max(n, min), max) : fallback);

/**
 * One page of a view's articles. options: { q, filters: { sentiment, … },
 * aiOnly, offset, limit }. Returns { articles, total, unread, facets,
 * nextOffset } where total counts every match, unread counts the view's
 * unread articles, and nextOffset is null on the last page.
 */
export function getArticlePage(view, id, options = {}) {
  const where = viewWhere(view, id);
  const opts = {
    view,
    q: options.q || '',
    filters: options.filters || {},
    aiOnly: Boolean(options.aiOnly),
    offset: clamp(options.offset, 0, Number.MAX_SAFE_INTEGER, 0),
    limit: clamp(options.limit, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE),
  };
  const tokens = tokenizeQuery(opts.q).slice(0, 10);
  const page = tokens.length ? searchPage(where, tokens, opts) : browsePage(where, opts);
  const end = opts.offset + page.articles.length;
  return {
    articles: page.articles,
    total: page.total,
    unread: count({ sql: `${where.sql} AND is_read = 0`, params: where.params }),
    facets: facetsToArrays(page.facets),
    nextOffset: end < page.total ? end : null,
  };
}

/** Marks every unread article in a view read; returns how many changed. */
export function markViewRead(view, id) {
  const where = viewWhere(view, id);
  return db.prepare(`UPDATE articles SET is_read = 1 WHERE ${where.sql} AND is_read = 0`).run(...where.params).changes;
}
