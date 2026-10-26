import { Router } from 'express';
import { saveSummary, getAllSummaries, removeSummary, buildCSV, DB_PATH } from '../db/summaries.js';

const router = Router();

/** POST /api/summaries — save a new summary */
router.post('/', (req, res) => {
  const { summary_text } = req.body;
  if (!summary_text?.trim()) {
    return res.status(400).json({ error: 'summary_text is required' });
  }
  try {
    const row = saveSummary(req.body);
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/summaries — return all summaries, newest first */
router.get('/', (req, res) => {
  try {
    res.json(getAllSummaries());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/summaries/:id — delete one summary */
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const deleted = removeSummary(id);
    deleted ? res.json({ ok: true }) : res.status(404).json({ error: 'Not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/summaries/export — download as CSV */
router.get('/export', (req, res) => {
  try {
    const csv = buildCSV();
    const filename = `tenwise-summaries-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv); // BOM so Excel opens UTF-8 correctly
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/summaries/db-path — returns the path to the .db file */
router.get('/db-path', (req, res) => {
  res.json({ path: DB_PATH });
});

export default router;
