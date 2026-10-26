import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { serveRouter } from './testServer.js';

// Only cached icons are served here: a cache miss would fetch from the site.
let api;
before(async () => {
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-favicon-routes-'));
  const { saveCachedFavicon } = await import('../db/reader.js');
  saveCachedFavicon('icons.example', { type: 'image/png', body: Buffer.from('png-bytes') });
  saveCachedFavicon('no-icon.example', null);
  const { default: router } = await import('./favicon.js');
  api = await serveRouter(router);
});
after(() => api.close());

test('a cached icon is served for a week, with scripts and sniffing forbidden', async () => {
  const res = await api.get('/icons.example');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(res.text, 'png-bytes');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=604800');
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'.*sandbox/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('host names are matched without regard to case', async () => {
  assert.equal((await api.get('/ICONS.Example')).text, 'png-bytes');
});

test('a site known to have no icon is a 404, rechecked after a day', async () => {
  const res = await api.get('/no-icon.example');
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=86400');
});

test('anything but a public DNS name is refused before any fetch', async () => {
  for (const host of ['localhost', '127.0.0.1', 'example.com:8080', 'intranet']) {
    const res = await api.get(`/${encodeURIComponent(host)}`);
    assert.equal(res.status, 400, host);
    assert.deepEqual(res.body, { error: 'Invalid host' });
  }
});
