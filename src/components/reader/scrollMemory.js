// Remembered reading positions, kept in localStorage across sessions as an
// ordered list of [articleId, scrollTop] pairs, oldest first. Only the most
// recent MAX_ENTRIES articles are kept.

const STORAGE_KEY = 'tenwise-scroll-positions';
const MAX_ENTRIES = 300;

function readAll(storage) {
  try {
    const entries = JSON.parse(storage.getItem(STORAGE_KEY));
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

/** The saved scroll offset for an article, or 0. */
export function loadScrollPosition(articleId, storage = globalThis.localStorage) {
  const entry = readAll(storage).find(([id]) => id === articleId);
  return entry ? entry[1] : 0;
}

/** Saves (or, for the top of the article, forgets) an article's scroll offset. */
export function saveScrollPosition(articleId, scrollTop, storage = globalThis.localStorage) {
  const entries = readAll(storage).filter(([id]) => id !== articleId);
  if (scrollTop > 0) entries.push([articleId, Math.round(scrollTop)]);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch { /* storage full or blocked: positions are a convenience */ }
}
