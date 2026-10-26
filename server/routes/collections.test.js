import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { serveRouter } from './testServer.js';

let api;
let reader;
before(async () => {
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-collection-routes-'));
  reader = await import('../db/reader.js');
  const { default: router } = await import('./collections.js');
  api = await serveRouter(router);
});
after(() => api.close());

let feedCount = 0;
function addArticles(n) {
  feedCount += 1;
  const feed = reader.createFeed({ title: `Source ${feedCount}`, url: `https://c${feedCount}.example/rss` });
  reader.bulkInsertArticles(feed.id, Array.from({ length: n }, (_, i) => ({
    guid: `c${feedCount}-${i}`, title: `Piece ${i}`, link: `https://c${feedCount}.example/${i}`,
    content: `<p>Text of piece ${i}.</p>`, publishedAt: new Date(Date.UTC(2026, 1, 1 + i)).toISOString(),
  })));
  return reader.getArticlesByAiStatus('none').filter((a) => a.feedId === feed.id).map((a) => a.id);
}

test('create, list, rename and delete a collection', async () => {
  const created = await api.post('/', { name: '  Agents  ', description: 'Reading on agents' });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, 'Agents');
  assert.equal(created.body.count, 0);
  await api.post('/', { name: 'Batteries' });
  assert.deepEqual((await api.get('/')).body.map((c) => c.name), ['Agents', 'Batteries']);

  const renamed = await api.put(`/${created.body.id}`, { name: 'AI agents' });
  assert.equal(renamed.body.name, 'AI agents');
  assert.equal(renamed.body.description, 'Reading on agents', 'fields not sent are kept');

  assert.deepEqual((await api.delete(`/${created.body.id}`)).body, { ok: true });
  assert.equal((await api.delete(`/${created.body.id}`)).status, 404);
  assert.equal((await api.delete('/0')).status, 400);
});

test('bad input is a 400; a taken name is a 409; an unknown id is a 404', async () => {
  assert.deepEqual((await api.post('/', {})).body, { error: 'name is required' });
  assert.equal((await api.post('/', { name: 'x'.repeat(81) })).status, 400);
  assert.equal((await api.post('/', { name: 'Ok', description: 42 })).status, 400);
  const taken = (await api.post('/', { name: 'Chips' })).body;
  const duplicate = await api.post('/', { name: 'CHIPS' });
  assert.equal(duplicate.status, 409, 'names are unique ignoring case');
  assert.match(duplicate.body.error, /already exists/);

  const other = (await api.post('/', { name: 'Chips 2' })).body;
  assert.equal((await api.put(`/${other.id}`, { name: 'chips' })).status, 409);
  assert.deepEqual((await api.put(`/${taken.id}`, {})).body, { error: 'nothing to change' });
  assert.equal((await api.put('/abc', { name: 'x' })).status, 400);
  assert.equal((await api.put('/999999', { name: 'Nobody' })).status, 404);
});

test('adding articles saves them; removing takes them out but keeps them saved', async () => {
  const [a, b] = addArticles(2);
  const reading = (await api.post('/', { name: 'Reading list' })).body;
  const added = await api.post(`/${reading.id}/add`, { articleIds: [a, b, a, 999999] });
  assert.equal(added.body.count, 2, 'duplicates and unknown ids are skipped');
  assert.equal(reader.getArticleById(a).isBookmarked, 1);
  assert.deepEqual((await api.get(`/of/${a}`)).body, [reading.id]);

  const removed = await api.post(`/${reading.id}/remove`, { articleIds: [a] });
  assert.equal(removed.body.count, 1);
  assert.deepEqual((await api.get(`/of/${a}`)).body, []);
  assert.equal(reader.getArticleById(a).isBookmarked, 1, 'still saved');

  assert.deepEqual((await api.post(`/${reading.id}/add`, { articleIds: [] })).body, { error: 'articleIds[] is required' });
  assert.equal((await api.post(`/${reading.id}/add`, { articleIds: ['1'] })).status, 400);
  assert.equal((await api.post('/999999/add', { articleIds: [a] })).status, 404);
  assert.equal((await api.post('/abc/remove', { articleIds: [a] })).status, 400);
  assert.equal((await api.get('/of/abc')).status, 400);
});

test('a collection exports as one Markdown download', async () => {
  const [a] = addArticles(1);
  const notes = (await api.post('/', { name: 'Notes: Q3 / chips!', description: 'For NotebookLM' })).body;
  await api.post(`/${notes.id}/add`, { articleIds: [a] });
  const res = await api.get(`/${notes.id}/export.md`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/markdown/);
  assert.equal(res.headers.get('content-disposition'), 'attachment; filename="notes-q3-chips.md"');
  assert.match(res.text, /^# Notes: Q3 \/ chips!/);
  assert.match(res.text, /For NotebookLM/);
  assert.match(res.text, /## Piece 0/);
  assert.match(res.text, /Text of piece 0\./);

  const symbols = (await api.post('/', { name: '!!!' })).body;
  assert.match((await api.get(`/${symbols.id}/export.md`)).headers.get('content-disposition'), /filename="collection\.md"/);
  assert.equal((await api.get('/999999/export.md')).status, 404);
  assert.equal((await api.get('/-1/export.md')).status, 400);
});
