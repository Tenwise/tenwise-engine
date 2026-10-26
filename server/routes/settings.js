import { Router } from 'express';
import { readSettings, SETTINGS_PATH, updateSettings } from '../settings.js';

const router = Router();

/** GET /api/settings → { values, path } */
router.get('/', (req, res) => {
  res.json({ values: readSettings(), path: SETTINGS_PATH });
});

/** PUT /api/settings { values: { key: string | null } } → { values } */
router.put('/', (req, res) => {
  try {
    res.json({ values: updateSettings(req.body.values) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
