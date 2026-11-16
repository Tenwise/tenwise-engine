import { Router } from 'express';
import { extractArticle } from '../utils/articleExtractor.js';
import { knownArticleId, savePage } from '../db/savedPages.js';

const MAX_URL = 2048;
const MAX_NOTE = 2000;

const isAbsent = (v) => v === undefined || v === null;
const urlOk = (url) => typeof url === 'string' && url.length <= MAX_URL && /^https?:\/\//i.test(url.trim());
const noteOk = (note) => isAbsent(note) || (typeof note === 'string' && note.length <= MAX_NOTE);
const collectionOk = (id) => isAbsent(id) || (Number.isInteger(id) && id > 0);

// The request's page address, note and collection, or { error }.
function parse({ url, note, collectionId } = {}) {
  if (!urlOk(url)) return { error: 'Paste the page\'s address, starting with https://' };
  if (!noteOk(note)) return { error: `A note is at most ${MAX_NOTE} characters` };
  if (!collectionOk(collectionId)) return { error: 'invalid collection' };
  return { value: { url: url.trim(), note: note?.trim() || null, collectionId: collectionId ?? null } };
}

/**
 * POST /api/pages { url, note?, collectionId? } — save a page from a link
 * (BRF-08). The page is fetched and read like any article (the guarded
 * fetch and extraction, no new fetch path), saved in the library's "Saved
 * pages" feed, and put in the collection. 201 for a new page, 200 when it
 * was already in the library; 422 when the page can't be read.
 */
export function pagesRouter({ extract = extractArticle } = {}) {
  const router = Router();
  router.post('/', async (req, res) => {
  const { value, error } = parse(req.body);
  if (error) return res.status(400).json({ error });
  // Already in the library: saved again, without fetching it.
  let page = null;
  try {
    if (!knownArticleId(value.url)) page = await extract(value.url);
  } catch (err) {
    return res.status(422).json({ error: `Couldn't read that page: ${err.message}`, reason: err.reason ?? 'failed' });
  }
  try {
    const saved = savePage({ url: value.url, page, note: value.note, collectionId: value.collectionId });
    if (!saved) return res.status(404).json({ error: 'That collection is gone' });
    return res.status(saved.duplicate ? 200 : 201).json(saved);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
  });
  return router;
}

export default pagesRouter();
