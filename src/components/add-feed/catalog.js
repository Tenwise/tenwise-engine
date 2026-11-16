// The feed catalog (GRO-14): Add feeds → Popular and Search, and what a
// welcome offers (the hosted app's). Built in: src/catalog/popular-feeds.json,
// each category's feeds best first. A plugin's feedCatalog can replace it
// (src/plugins/index.js), as the hosted app does with the catalog the
// maintainer stores; it is asked once per page load.
import { useEffect, useState } from 'react';
import builtIn from '../../catalog/popular-feeds.json' with { type: 'json' };
import { pluginsOf } from '../../plugins/index.js';

export const POPULAR_FEEDS = builtIn.categories;

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

const isFeed = (f) => typeof f?.title === 'string' && typeof f?.url === 'string';
const isCategory = (c) => typeof c?.id === 'string' && typeof c?.category === 'string' && Array.isArray(c.feeds) && c.feeds.length > 0 && c.feeds.every(isFeed);

/** True for a catalog the app can show: categories, each with feeds. */
export const isCatalog = (list) => Array.isArray(list) && list.length > 0 && list.every(isCategory);

let current = POPULAR_FEEDS;
let loading = null;
const listeners = new Set();

// One plugin's catalog, or null when it fails or answers with something else.
async function catalogOf({ load }) {
  try {
    const list = await load();
    return isCatalog(list) ? list : null;
  } catch {
    return null;
  }
}

/**
 * The catalog in use: the first plugin's that resolves to one, else the
 * built-in. Asked once.
 */
export function loadCatalog() {
  loading ??= (async () => {
    for (const source of pluginsOf('feedCatalog')) {
      const list = await catalogOf(source);
      if (list) {
        current = list;
        for (const listener of listeners) listener(list);
        break;
      }
    }
    return current;
  })();
  return loading;
}

/** For tests: back to the built-in catalog, not yet loaded. */
export function resetCatalog() {
  current = POPULAR_FEEDS;
  loading = null;
}

/** The catalog in use, for a component: the built-in at once, a plugin's once it has loaded. */
export function useCatalog() {
  const [list, setList] = useState(current);
  useEffect(() => {
    listeners.add(setList);
    loadCatalog().then(setList);
    return () => { listeners.delete(setList); };
  }, []);
  return list;
}
