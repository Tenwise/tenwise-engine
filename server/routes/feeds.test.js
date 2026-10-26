import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serveRouter } from './testServer.js';
import router from './feeds.js';

// Only requests that are refused before any fetch: nothing leaves this machine.
let api;
before(async () => { api = await serveRouter(router); });
after(() => api.close());

test('parsing needs a feed URL', async () => {
  const res = await api.post('/parse', {});
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: 'Feed URL is required' });
});

test('a feed on a private address is refused, with the reason', async () => {
  const res = await api.post('/parse', { url: 'http://192.168.1.1/rss' });
  assert.equal(res.status, 500);
  assert.equal(res.body.error, 'Failed to parse feed: Blocked private or loopback address');
  assert.equal((await api.post('/parse', { url: 'ftp://example.com/rss' })).body.error, 'Failed to parse feed: Blocked URL scheme: ftp:');
});
