// Pictures for cards whose feed gave none (UX-8): asked of the server
// (GET /api/reader/articles/:id/image), a few at a time, once per article per
// page load. Cards only exist while on screen (the list is virtual), so only
// what's seen is asked for.
import { useEffect, useState } from 'react';
import { fetchArticleImage } from '../../utils/api.js';
import { foreignImageUrl } from '../../utils/imageUrl.js';

const AT_ONCE = 3;
const known = new Map(); // article id → url, or null for none
let running = 0;
const waiting = [];

function pump() {
  while (running < AT_ONCE && waiting.length > 0) {
    const { id, resolve, fetchImage } = waiting.shift();
    running += 1;
    fetchImage(id)
      .then((r) => r?.imageUrl ?? null, () => null)
      .then((url) => { known.set(id, url); resolve(url); })
      .finally(() => { running -= 1; pump(); });
  }
}

/** The picture for an article: known, or asked for in turn; resolves to a URL or null. */
export function imageFor(id, fetchImage = fetchArticleImage) {
  if (known.has(id)) return Promise.resolve(known.get(id));
  return new Promise((resolve) => { waiting.push({ id, resolve, fetchImage }); pump(); });
}

/** Forgets what was found (tests). */
export function resetImages() { known.clear(); waiting.length = 0; running = 0; }

/**
 * The card's picture: the article's own, else one found for it once it's on
 * screen; null for one on the app's own site (SEC-022, utils/imageUrl.js).
 */
export function useCardImage(article) {
  const [found, setFound] = useState(() => known.get(article.id) ?? null);
  useEffect(() => {
    if (article.imageUrl || !article.id || !article.link) return undefined;
    let live = true;
    imageFor(article.id).then((url) => { if (live) setFound(url); });
    return () => { live = false; };
  }, [article.id, article.imageUrl, article.link]);
  return foreignImageUrl(article.imageUrl || found, globalThis.location?.origin);
}
