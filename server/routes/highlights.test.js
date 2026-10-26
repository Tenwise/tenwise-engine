import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { serveRouter } from './testServer.js';

let dataDir;
let api;
before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'tenwise-highlight-routes-'));
  process.env.TENWISE_DATA_DIR = dataDir;
  const { default: router } = await import('./highlights.js');
  api = await serveRouter(router);
});
after(() => api.close());

const ARTICLE = 'https://news.example/chips';
const pause = () => new Promise((resolve) => { setTimeout(resolve, 5); });

test('saving a highlight needs its text, and fills in defaults', async () => {
  assert.deepEqual((await api.post('/', { highlighted_text: '   ' })).body, { error: 'highlighted_text is required' });
  const saved = await api.post('/', { highlighted_text: 'Chips got cheaper.', article_url: ARTICLE, article_title: 'Chips' });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.highlighted_text, 'Chips got cheaper.');
  assert.equal(saved.body.color, 'yellow');
  assert.equal(saved.body.note, null);
  assert.ok(saved.body.id);
  assert.ok(saved.body.created_at);
});

test('highlights list newest first, by article, with a count', async () => {
  const before = (await api.get('/count')).body.count;
  await pause();
  const first = (await api.post('/', { highlighted_text: 'First', article_url: ARTICLE, color: 'green' })).body;
  await pause();
  const second = (await api.post('/', { highlighted_text: 'Second', article_url: 'https://other.example/' })).body;

  const all = (await api.get('/')).body;
  assert.deepEqual(all.slice(0, 2).map((h) => h.id), [second.id, first.id]);
  const forArticle = (await api.get(`/by-article?url=${encodeURIComponent(ARTICLE)}`)).body;
  assert.ok(forArticle.every((h) => h.article_url === ARTICLE));
  assert.ok(forArticle.some((h) => h.id === first.id && h.color === 'green'));
  assert.equal((await api.get('/by-article')).status, 400);
  assert.deepEqual((await api.get('/count')).body, { count: before + 2 });
});

test('deleting a highlight', async () => {
  const saved = (await api.post('/', { highlighted_text: 'Short-lived' })).body;
  assert.deepEqual((await api.delete(`/${saved.id}`)).body, { ok: true });
  assert.equal((await api.delete(`/${saved.id}`)).status, 404);
  assert.equal((await api.delete('/abc')).status, 400);
  assert.ok(!(await api.get('/')).body.some((h) => h.id === saved.id));
});

test('the CSV export is a dated download that spreadsheets open safely', async () => {
  await api.post('/', { highlighted_text: '=HYPERLINK("http://evil.example")', note: 'a, "quoted" note', article_url: ARTICLE });
  const res = await api.get('/export');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/csv; charset=utf-8/);
  assert.match(res.headers.get('content-disposition'), /^attachment; filename="tenwise-highlights-\d{4}-\d{2}-\d{2}\.csv"$/);
  assert.equal(res.text.charCodeAt(0), 0xfeff, 'starts with a BOM so Excel reads UTF-8');
  const lines = res.text.slice(1).split('\n');
  assert.equal(lines[0], 'ID,Saved At,Highlighted Text,Note,Color,Article Title,Source,Article URL');
  assert.match(lines[1], /,"'=HYPERLINK\(""http:\/\/evil\.example""\)","a, ""quoted"" note",yellow,,,https:\/\/news\.example\/chips$/);
});

test('the database path is reader.db in the data directory', async () => {
  assert.deepEqual((await api.get('/db-path')).body, { path: join(dataDir, 'reader.db') });
});
