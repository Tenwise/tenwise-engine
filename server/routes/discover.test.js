import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serveRouter } from './testServer.js';
import router from './discover.js';

// Only requests that are refused before any fetch: nothing leaves this machine.
let api;
before(async () => { api = await serveRouter(router); });
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
