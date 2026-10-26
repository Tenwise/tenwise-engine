import { Router } from 'express';
import {
  saveHighlight,
  getAllHighlights,
  getHighlightsByArticleUrl,
  removeHighlight,
  getHighlightsCount,
  buildCSV,
  DB_PATH,
} from '../db/highlights.js';

const router = Router();

/** POST /api/highlights — save a new highlight */
router.post('/', (req, res) => {
  const { highlighted_text } = req.body;
  if (!highlighted_text?.trim()) {
    return res.status(400).json({ error: 'highlighted_text is required' });
  }
  try {
    const row = saveHighlight(req.body);
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/highlights — return all highlights, newest first */
router.get('/', (req, res) => {
  try {
    res.json(getAllHighlights());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/highlights/by-article?url=<url> — highlights for a specific article */
router.get('/by-article', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url query param is required' });
  try {
    res.json(getHighlightsByArticleUrl(url));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/highlights/count — total highlight count for sidebar badge */
router.get('/count', (req, res) => {
  try {
    res.json({ count: getHighlightsCount() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/highlights/:id — delete one highlight */
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const deleted = removeHighlight(id);
    deleted ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/highlights/export — download as CSV */
router.get('/export', (req, res) => {
  try {
    const csv = buildCSV();
    const filename = `tenwise-highlights-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv); // BOM so Excel opens UTF-8 correctly
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/highlights/db-path — returns the path to the .db file */
router.get('/db-path', (req, res) => {
  res.json({ path: DB_PATH });
});

export default router;
