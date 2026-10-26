import { Router } from 'express';
import { getCachedFavicon, saveCachedFavicon } from '../db/reader.js';
import { createFaviconCache, isValidHostname } from '../utils/favicon.js';

const router = Router();
const cache = createFaviconCache({ read: getCachedFavicon, write: saveCachedFavicon });
const DAY_SECONDS = 24 * 60 * 60;
const WEEK_SECONDS = 7 * DAY_SECONDS;

/**
 * GET /api/favicon/:host
 * The site's icon, fetched by this server and cached in reader.db. 404 when the
 * site has none; the UI then shows its generic feed icon.
 */
router.get('/:host', async (req, res) => {
  const host = req.params.host.toLowerCase();
  if (!isValidHostname(host)) return res.status(400).json({ error: 'Invalid host' });
  try {
    const icon = await cache.get(host);
    res.set('Cache-Control', `public, max-age=${icon ? WEEK_SECONDS : DAY_SECONDS}`);
    // Icons come from third-party sites and may be SVG. Served from our own
    // origin, an SVG opened directly could run script against this API, so
    // forbid scripts and content sniffing.
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.set('X-Content-Type-Options', 'nosniff');
    if (!icon) return res.status(404).end();
    res.type(icon.type).send(icon.body);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
