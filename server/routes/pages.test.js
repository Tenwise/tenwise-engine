import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { serveRouter } from './testServer.js';

let api;
let db;
let reader;
let refresh;
const pages = {
  'https://blog.example/post': { title: 'A post worth citing', content: '<p>The <b>full</b> text.</p>', author: 'Ann Lee', publishedAt: '2026-10-20T10:00:00Z', description: 'A summary', url: 'https://blog.example/post' },
  'https://short.example/x': { title: 'Moved page', content: '<p>Body</p>', url: 'https://blog.example/canonical' },
};
before(async () => {
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-pages-'));
  ({ db } = await import('../db/database.js'));
  reader = await import('../db/reader.js');
  refresh = await import('../refresh/feedRefresh.js');
  const { pagesRouter } = await import('./pages.js');
  const extract = async (url) => {
    if (!pages[url]) throw Object.assign(new Error('the site refused the request (403)'), { reason: 'blocked' });
    return pages[url];
  };
  api = await serveRouter(pagesRouter({ extract }));
});
after(() => api.close());

const collection = (name) => Number(db.prepare("INSERT INTO collections (name, created_at, updated_at) VALUES (?, '2026-10-30', '2026-10-30')").run(name).lastInsertRowid);

test('a page is saved with its note, in the collection, in the Saved pages feed', async () => {
  const id = collection('Research');
  const res = await api.post('/', { url: 'https://blog.example/post', note: 'cite in the next brief', collectionId: id });
  assert.equal(res.status, 201);
  const { article } = res.body;
  assert.equal(article.title, 'A post worth citing');
  assert.equal(article.note, 'cite in the next brief');
  assert.ok(article.isBookmarked);
  assert.match(reader.getArticleById(article.id).content, /full/);
  const feed = reader.getFeed(article.feedId);
  assert.equal(feed.title, 'Saved pages');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM collection_items WHERE collection_id = ? AND article_id = ?').get(id, article.id).n, 1);
});

test('the same page again is not duplicated, by its address or the one the page gives', async () => {
  const again = await api.post('/', { url: 'https://blog.example/post' });
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, true);
  assert.equal((await api.post('/', { url: 'https://short.example/x' })).status, 201);
  const viaCanonical = await api.post('/', { url: 'https://blog.example/canonical' });
  assert.equal(viaCanonical.status, 200, 'known by its canonical address, so not fetched again');
  assert.equal(viaCanonical.body.duplicate, true);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM articles WHERE link = 'https://blog.example/post'").get().n, 1);
});

test('a page that can\'t be read says why; bad requests are refused', async () => {
  const blocked = await api.post('/', { url: 'https://paywall.example/a' });
  assert.equal(blocked.status, 422);
  assert.match(blocked.body.error, /Couldn't read that page: the site refused/);
  assert.equal((await api.post('/', { url: 'javascript:alert(1)' })).status, 400);
  assert.equal((await api.post('/', { url: 'ftp://x.example/a' })).status, 400);
  assert.equal((await api.post('/', { url: 'https://blog.example/post', collectionId: 'x' })).status, 400);
  assert.equal((await api.post('/', { url: 'https://blog.example/post', collectionId: 99999 })).status, 404);
});

test('refresh never fetches the Saved pages feed', async () => {
  const feed = reader.listFeeds().find((f) => f.title === 'Saved pages');
  const result = await refresh.refreshFeed(feed, async () => { throw new Error('fetched'); });
  assert.deepEqual({ inserted: result.inserted, failed: result.failed }, { inserted: 0, failed: false });
});
