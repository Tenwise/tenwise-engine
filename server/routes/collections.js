import { Router } from 'express';
import {
  addToCollection, collectionsOfArticle, createCollection, deleteCollection, DuplicateNameError,
  listCollections, removeFromCollection, updateCollection,
} from '../db/collections.js';
import { collectionMarkdown } from '../db/collectionExport.js';
import { parseArticleIds, parseCollection } from './collectionsInput.js';

const router = Router();

const idOf = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

function fail(res, err) {
  if (err instanceof DuplicateNameError) return res.status(409).json({ error: err.message });
  return res.status(500).json({ error: err.message });
}

const found = (res, collection) => (collection ? res.json(collection) : res.status(404).json({ error: 'Not found' }));

/** GET /api/collections — every collection, by name, with its article count. */
router.get('/', (req, res) => {
  try { res.json(listCollections()); } catch (err) { fail(res, err); }
});

/** GET /api/collections/of/:articleId — ids of the collections an article is in. */
router.get('/of/:articleId', (req, res) => {
  const articleId = idOf(req.params.articleId);
  if (!articleId) return res.status(400).json({ error: 'invalid id' });
  try { return res.json(collectionsOfArticle(articleId)); } catch (err) { return fail(res, err); }
});

// A file name from a collection name: letters, digits and dashes.
const fileNameOf = (name) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'collection'}.md`;

/** GET /api/collections/:id/export.md — the collection's articles as one Markdown file (for NotebookLM). */
router.get('/:id/export.md', (req, res) => {
  // nosemgrep: ajinabraham.njsscan.xss.xss_node.express_xss -- a text/markdown attachment, served with nosniff
  const id = idOf(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  try {
    const file = collectionMarkdown(id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    res.set('Content-Type', 'text/markdown; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${fileNameOf(file.name)}"`);
    return res.send(file.markdown);
  } catch (err) { return fail(res, err); }
});

/** POST /api/collections { name, description? } */
router.post('/', (req, res) => {
  const { value, error } = parseCollection(req.body, { required: true });
  if (error) return res.status(400).json({ error });
  try { return res.status(201).json(createCollection(value)); } catch (err) { return fail(res, err); }
});

/** PUT /api/collections/:id { name?, description? } */
router.put('/:id', (req, res) => {
  const id = idOf(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  const { value, error } = parseCollection(req.body, { required: false });
  if (error) return res.status(400).json({ error });
  try { return found(res, updateCollection(id, value)); } catch (err) { return fail(res, err); }
});

/** DELETE /api/collections/:id — the articles stay saved. */
router.delete('/:id', (req, res) => {
  const id = idOf(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  try {
    return deleteCollection(id) ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' });
  } catch (err) { return fail(res, err); }
});

// POST /api/collections/:id/add and /remove { articleIds } — adding also saves them.
for (const [path, change] of [['add', addToCollection], ['remove', removeFromCollection]]) {
  router.post(`/:id/${path}`, (req, res) => {
    const id = idOf(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const { value, error } = parseArticleIds(req.body);
    if (error) return res.status(400).json({ error });
    try { return found(res, change(id, value)); } catch (err) { return fail(res, err); }
  });
}

export default router;
