import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serveRouter } from './testServer.js';
import router from './articles.js';

// Only requests that are refused before any fetch: nothing leaves this machine.
let api;
before(async () => { api = await serveRouter(router); });
after(() => api.close());

test('extraction needs an article URL', async () => {
  const res = await api.post('/extract', {});
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: 'Article URL is required' });
});

test('an article on a private or metadata address is refused, with the reason', async () => {
  const res = await api.post('/extract', { url: 'http://169.254.169.254/latest/meta-data/' });
  assert.equal(res.status, 500);
  assert.equal(res.body.error, 'Article extraction failed: Blocked private or loopback address');
  assert.deepEqual([res.body.reason, res.body.site], ['failed', '169.254.169.254']);
  assert.equal((await api.post('/extract', { url: 'http://10.0.0.8/post' })).status, 500);
});
