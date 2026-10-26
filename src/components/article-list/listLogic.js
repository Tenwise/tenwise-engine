import { csvCell } from '../../../shared/csv.js';

// Pure helpers for the article list: cached pages, empty-state copy, CSV.

const VIEW_TITLES = { all: 'All Articles', today: 'Today', saved: 'Saved', unsorted: 'Unsorted saves' };

export function viewTitle(view) {
  if (VIEW_TITLES[view.type]) return VIEW_TITLES[view.type];
  if (view.type === 'feed') return view.name || 'Feed';
  if (view.type === 'folder') return view.name || 'Folder';
  if (view.type === 'collection') return view.name || 'Collection';
  return 'Articles';
}

const EMPTY_BY_VIEW = {
  saved: { title: 'Nothing saved yet', body: 'Press b to save an article, or n to save it with a note' },
  today: { title: 'All caught up', body: 'No new articles published today' },
  collection: { title: 'Nothing in this collection yet', body: 'Press c on an article to add it here' },
  unsorted: { title: 'All sorted', body: 'Every save is in a collection. New saves land here until you file them' },
};

/** Title and body for the empty list, depending on why it is empty. */
export function emptyStateText({ serverDown, hasActiveFilters, searchQuery, viewType }) {
  if (serverDown) return { title: "Can't load articles", body: "The Tenwise server isn't answering" };
  if (hasActiveFilters) return { title: 'No matching articles', body: 'No articles match the active filters' };
  if (searchQuery) return { title: 'No matching articles', body: `No articles match "${searchQuery}"` };
  return EMPTY_BY_VIEW[viewType] || { title: 'Your feed is empty', body: 'Add feeds from the sidebar to start reading' };
}


/** CSV of articles: Title, Source, Published, URL, Read, Bookmarked. */
export function articlesToCSV(articles, sourceOf) {
  const header = 'Title,Source,Published,URL,Read,Bookmarked';
  const rows = articles.map((a) => [
    csvCell(a.title),
    csvCell(sourceOf(a)),
    a.publishedAt ? new Date(a.publishedAt).toISOString() : '',
    csvCell(a.link),
    a.isRead ? 'yes' : 'no',
    a.isBookmarked ? 'yes' : 'no',
  ].join(','));
  return [header, ...rows].join('\n');
}

export function downloadCSV(csv, filename) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const el = document.createElement('a');
  el.href = url;
  el.download = filename;
  document.body.appendChild(el);
  el.click();
  document.body.removeChild(el);
  URL.revokeObjectURL(url);
}

/** Groups articles into rows of `columns` (the last row may be shorter). */
export function chunkRows(articles, columns) {
  const rows = [];
  for (let i = 0; i < articles.length; i += columns) rows.push(articles.slice(i, i + columns));
  return rows;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Day heading for an article: Today, Yesterday, Earlier this week (last 7 days) or Older. */
export function dayGroup(dateStr, now = new Date()) {
  const time = Date.parse(dateStr);
  if (!Number.isFinite(time)) return 'Older';
  const days = Math.floor((startOfDay(now) - startOfDay(new Date(time))) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'Earlier this week';
  return 'Older';
}

const SAVED_HEADINGS = { Today: 'Saved today', Yesterday: 'Saved yesterday', 'Earlier this week': 'Saved this week', Older: 'Saved earlier' };

/** Day headings by publication date (most lists). */
export const BY_PUBLISHED = { dateOf: (a) => a.publishedAt, label: (group) => group };
/** Day headings by when each article was saved (lists of saves, which are in that order). */
export const BY_SAVED = { dateOf: (a) => a.savedAt, label: (group) => SAVED_HEADINGS[group] };

const SAVE_ORDERED_VIEWS = new Set(['saved', 'unsorted', 'collection']);
/** Whether a view lists saves (in save order), where filing shortcuts matter most. */
export const isSaveList = (viewType) => SAVE_ORDERED_VIEWS.has(viewType);
/** How a view's list is grouped under day headings; it matches the server's order for the view. */
export const groupingFor = (viewType) => (isSaveList(viewType) ? BY_SAVED : BY_PUBLISHED);

/**
 * The list as rows for the Rows view: one item per article (position is its
 * index in the list), the first of each run from the same day group carrying
 * that group's heading. The heading rides on its article, not on an item of
 * its own, so every item is a list item for screen readers. Assumes
 * newest-first order (by the grouping's date); a group that recurs later
 * (unusual sort) simply gets another heading.
 */
export function withDayHeaders(articles, now = new Date(), grouping = BY_PUBLISHED) {
  let current = null;
  return articles.map((article, position) => {
    const item = { type: 'article', key: article.id, article, position };
    const label = grouping.label(dayGroup(grouping.dateOf(article), now));
    if (label === current) return item;
    current = label;
    // Its own key: the virtualizer caches heights by key, and this row is taller.
    return { ...item, key: `${article.id}-h`, heading: label };
  });
}

/** Compact time for a row: "19:12" today, a weekday this week, else "Oct 3" (or "Oct 3, 2025"). */
export function shortTime(dateStr, now = new Date()) {
  const time = Date.parse(dateStr);
  if (!Number.isFinite(time)) return '';
  const date = new Date(time);
  const group = dayGroup(dateStr, now);
  if (group === 'Today') return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  if (group !== 'Older') return date.toLocaleDateString(undefined, { weekday: 'short' });
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}

/** The loaded articles in page order, each once (offsets shift when articles arrive between pages). */
export function flattenPages(pages = []) {
  const seen = new Set();
  const articles = [];
  for (const page of pages) {
    for (const article of page.articles) {
      if (seen.has(article.id)) continue;
      seen.add(article.id);
      articles.push(article);
    }
  }
  return articles;
}

// How a change moves an article's read state: +1 newly read, -1 newly unread, 0 neither.
const readDelta = (article, changes) => {
  if (!('isRead' in changes) || Boolean(changes.isRead) === Boolean(article.isRead)) return 0;
  return changes.isRead ? 1 : -1;
};

/**
 * Cached list pages ({ pages: [{ articles, unread, … }] }) with `changes`
 * applied to the articles in idSet, and the unread count adjusted to match.
 */
export function patchPages(data, idSet, changes) {
  if (!data) return data;
  const counted = new Set();
  let nowRead = 0;
  const patch = (article) => {
    if (!idSet.has(article.id)) return article;
    if (!counted.has(article.id)) { counted.add(article.id); nowRead += readDelta(article, changes); }
    return { ...article, ...changes };
  };
  const pages = data.pages.map((page) => ({ ...page, articles: page.articles.map(patch) }));
  return { ...data, pages: pages.map((page) => ({ ...page, unread: Math.max(0, page.unread - nowRead) })) };
}
