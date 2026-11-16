// Pages saved from a link (BRF-08): research found outside the feeds, kept
// like any saved article so it can go in a collection and be cited in a
// brief. Every article belongs to a feed, so saved pages go in one local feed,
// "Saved pages", that refresh never fetches (its address isn't on the web).
import { db } from './database.js';
import { bulkInsertArticles, createFeed, findArticleByLink, getFeedByUrl, updateArticle } from './reader.js';
import { addToCollection } from './collections.js';

export const SAVED_PAGES_URL = 'tenwise:saved-pages';
export const SAVED_PAGES_TITLE = 'Saved pages';

/** True for a feed of Tenwise's own, which refresh skips. */
export const isLocalFeed = (feed) => typeof feed?.url === 'string' && feed.url.startsWith('tenwise:');

function savedPagesFeed() {
  return getFeedByUrl(SAVED_PAGES_URL) ?? createFeed({ title: SAVED_PAGES_TITLE, url: SAVED_PAGES_URL });
}

const byLinkOrCanonical = db.prepare('SELECT id FROM articles WHERE link = ? OR canonical_link = ? ORDER BY id LIMIT 1');

/** The id of the article already in the library at this address (its link or canonical link), or null. */
export const knownArticleId = (url) => (url ? byLinkOrCanonical.get(url, url)?.id ?? null : null);

// The article already in the library for this page, by its address or the one the page gave.
const known = (url, page) => knownArticleId(url) ?? (page?.url && page.url !== url ? knownArticleId(page.url) : null);

/**
 * Saves a page: page is the extractor's result ({ title, content, author,
 * publishedAt, description, image, url }), or null when the page is already
 * in the library, which is then saved again, not duplicated. note and collectionId are optional.
 * Returns { article, duplicate }; null when the collection doesn't exist.
 */
// Stores a new page in the Saved pages feed; returns its article.
function insertPage(url, page) {
  const feed = savedPagesFeed();
  bulkInsertArticles(feed.id, [{
    guid: url,
    link: url,
    canonicalLink: page.url && page.url !== url ? page.url : null,
    title: page.title || url,
    content: page.content,
    summary: page.description,
    author: page.author,
    publishedAt: page.publishedAt,
    imageUrl: page.image,
  }]);
  return findArticleByLink(url);
}

export const savePage = db.transaction(({ url, page, note, collectionId }) => {
  const knownId = known(url, page);
  const id = knownId ?? insertPage(url, page).id;
  const article = updateArticle(id, { isBookmarked: true, ...(note ? { note } : {}) });
  if (collectionId !== null && collectionId !== undefined && !addToCollection(collectionId, [id])) return null;
  return { article, duplicate: Boolean(knownId) };
});
