import { POPULAR_FEEDS } from '../../utils/constants.js';

export function getDomain(siteUrl) {
  try {
    return new URL(siteUrl).hostname.replace(/^www\./, '');
  } catch {
    return siteUrl;
  }
}

const matches = (q, ...fields) => fields.some((f) => (f || '').toLowerCase().includes(q));

/** Curated feeds whose title, description, or category contains the query. */
export function searchCatalog(query, catalog = POPULAR_FEEDS) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return catalog.flatMap((cat) => cat.feeds
    .filter((feed) => matches(q, feed.title, feed.description, cat.category))
    .map((feed) => ({ feed, category: cat.category, emoji: cat.emoji })));
}

export function categoriesFor(selected, catalog = POPULAR_FEEDS) {
  return selected === 'all' ? catalog : catalog.filter((c) => c.category === selected);
}
