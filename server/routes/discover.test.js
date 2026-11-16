import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { serveRouter } from './testServer.js';

// Only requests that are refused before any fetch: nothing leaves this
// machine. The route reads the followed feeds, so it gets its own database.
let api;
let reader;
let withFollowed;
before(async () => {
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-discover-'));
  reader = await import('../db/reader.js');
  const discover = await import('./discover.js');
  withFollowed = discover.withFollowed;
  api = await serveRouter(discover.default);
});
after(() => api.close());

test('discovery needs a website URL', async () => {
  const res = await api.post('/', {});
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: 'Website URL is required' });
});

test('discovery refuses private addresses and other schemes, with the reason', async () => {
  const loopback = await api.post('/', { url: 'http://127.0.0.1:3001/' });
  assert.equal(loopback.status, 500);
  assert.equal(loopback.body.error, 'Blocked private or loopback address');
  assert.equal((await api.post('/', { url: 'file:///etc/passwd' })).body.error, 'Blocked URL scheme: file:');
  assert.equal((await api.post('/', { url: 'not a url' })).body.error, 'Invalid URL');
});

test('a feed already followed at any of its addresses is listed at that address, marked followed (PR-23)', () => {
  reader.createFeed({ title: 'Carbon Brief', url: 'https://www.carbonbrief.org/feed/' });
  const found = { url: 'https://www.carbonbrief.org/feed', title: 'Carbon Brief', type: 'probed', urls: ['https://www.carbonbrief.org/feed', 'https://www.carbonbrief.org/feed/'] };
  assert.deepEqual(withFollowed(found), { url: 'https://www.carbonbrief.org/feed/', title: 'Carbon Brief', type: 'probed', followed: true });
  assert.deepEqual(withFollowed({ ...found, urls: ['https://e.example/rss'], url: 'https://e.example/rss' }), { url: 'https://e.example/rss', title: 'Carbon Brief', type: 'probed', followed: false });
});
