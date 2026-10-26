import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { serveRouter } from './testServer.js';

let dataDir;
let api;
before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'tenwise-reader-routes-'));
  process.env.TENWISE_DATA_DIR = dataDir;
  const { default: router } = await import('./reader.js');
  api = await serveRouter(router);
});
after(() => api.close());

let feedCount = 0;
async function newFeed(fields = {}) {
  feedCount += 1;
  const res = await api.post('/feeds', { title: `Feed ${feedCount}`, url: `https://feed${feedCount}.example/rss`, ...fields });
  assert.equal(res.status, 201);
  return res.body;
}

// Adds articles to a feed, one a day from 1 Jan 2026; returns their ids, newest first.
async function addArticles(feedId, n, extra = () => ({})) {
  const articles = Array.from({ length: n }, (_, i) => ({
    guid: `f${feedId}-${i}`, title: `Story ${i}`, link: `https://feed.example/${feedId}/${i}`,
    summary: `Summary ${i}`, content: `<p>Body of story ${i}</p>`,
    publishedAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(), ...extra(i),
  }));
  const res = await api.post('/articles/bulk-insert', { feedId, articles });
  assert.equal(res.status, 201);
  const page = await api.get(`/articles/page?view=feed&id=${feedId}`);
  return page.body.articles.map((a) => a.id);
}

test('folders: create, list in order, rename and find-or-create by name', async () => {
  assert.deepEqual((await api.post('/folders', {})).body, { error: 'name is required' });
  const tech = await api.post('/folders', { name: '  Tech  ' });
  assert.equal(tech.status, 201);
  assert.equal(tech.body.name, 'Tech');
  const news = (await api.post('/folders', { name: 'News', order: 50 })).body;
  assert.equal(news.order, 50);
  assert.deepEqual((await api.get('/folders')).body.map((f) => f.name), ['Tech', 'News']);

  const renamed = await api.put(`/folders/${tech.body.id}`, { name: 'Technology' });
  assert.equal(renamed.body.name, 'Technology');
  assert.equal(renamed.body.order, tech.body.order, 'a rename keeps the position');
  assert.equal((await api.put('/folders/abc', { name: 'x' })).status, 400);
  assert.equal((await api.put('/folders/999999', { name: 'x' })).status, 404);

  const found = await api.post('/folders/find-or-create', { name: ' News ' });
  assert.equal(found.status, 200);
  assert.equal(found.body.id, news.id);
  const made = await api.post('/folders/find-or-create', { name: 'Science' });
  assert.equal(made.status, 201);
  assert.equal(made.body.name, 'Science');
  assert.equal((await api.post('/folders/find-or-create', { name: '  ' })).status, 400);
});

test('deleting a folder keeps its feeds, unless asked to remove them (saves are kept)', async () => {
  const keep = (await api.post('/folders', { name: 'Keep feeds' })).body;
  const kept = await newFeed({ folderId: keep.id });
  assert.deepEqual((await api.delete(`/folders/${keep.id}`)).body, { ok: true, keptSaved: 0 });
  assert.equal((await api.get(`/feeds/${kept.id}`)).body.folderId, null);

  const drop = (await api.post('/folders', { name: 'Drop feeds' })).body;
  const dropped = await newFeed({ folderId: drop.id });
  const [saved] = await addArticles(dropped.id, 2);
  await api.put(`/articles/${saved}`, { isBookmarked: 1 });
  assert.deepEqual((await api.delete(`/folders/${drop.id}?withFeeds=true`)).body, { ok: true, keptSaved: 1 });
  assert.ok(!(await api.get('/feeds')).body.some((f) => f.id === dropped.id));
  assert.ok((await api.get('/feeds?removed=1')).body.some((f) => f.id === dropped.id));
  assert.equal((await api.get(`/articles/${saved}`)).body.isBookmarked, 1);
  assert.equal((await api.delete('/folders/abc')).status, 400);
});

test('feeds: create, read, update and list by folder; duplicates and bad references', async () => {
  assert.deepEqual((await api.post('/feeds', { title: 'No url' })).body, { error: 'url is required' });
  const feed = await newFeed();
  const again = await api.post('/feeds', { title: 'Again', url: feed.url });
  assert.equal(again.status, 409);
  assert.equal(again.body.error, 'Feed already exists');
  const orphan = await api.post('/feeds', { title: 'Orphan', url: 'https://orphan.example/rss', folderId: 999999 });
  assert.equal(orphan.status, 404);
  assert.equal(orphan.body.error, 'Feed or folder not found');

  assert.equal((await api.get(`/feeds/${feed.id}`)).body.url, feed.url);
  assert.equal((await api.get('/feeds/abc')).status, 400);
  assert.equal((await api.get('/feeds/999999')).status, 404);

  const updated = await api.put(`/feeds/${feed.id}`, { title: 'Renamed', lastError: 'Status code 503' });
  assert.equal(updated.body.title, 'Renamed');
  assert.equal(updated.body.lastError, 'Status code 503');
  assert.equal(updated.body.url, feed.url);
  assert.equal((await api.put('/feeds/abc', {})).status, 400);
  assert.equal((await api.put('/feeds/999999', { title: 'x' })).status, 404);

  const folder = (await api.post('/folders', { name: 'Only this' })).body;
  const inFolder = await newFeed({ folderId: folder.id });
  assert.deepEqual((await api.get(`/feeds?folder_id=${folder.id}`)).body.map((f) => f.id), [inFolder.id]);
});

test('removing a feed keeps it for its saves; subscribing again brings it back', async () => {
  const feed = await newFeed();
  const [saved] = await addArticles(feed.id, 3);
  await api.put(`/articles/${saved}`, { isBookmarked: true });
  assert.deepEqual((await api.delete(`/feeds/${feed.id}`)).body, { ok: true, keptSaved: 1 });
  const removed = (await api.get('/feeds?removed=1')).body.find((f) => f.id === feed.id);
  assert.ok(removed.removedAt);

  const back = await api.post('/feeds', { title: 'Back', url: feed.url });
  assert.equal(back.status, 201);
  assert.equal(back.body.id, feed.id);
  assert.equal(back.body.removedAt, null);
  assert.equal((await api.delete('/feeds/abc')).status, 400);

  const empty = await newFeed();
  assert.deepEqual((await api.delete(`/feeds/${empty.id}`)).body, { ok: true, keptSaved: 0 });
  assert.equal((await api.get(`/feeds/${empty.id}`)).status, 404, 'a feed with no saves is deleted');
});

test('bulk insert stores each article once and checks its input', async () => {
  const feed = await newFeed();
  const articles = [
    { guid: 'a', title: 'A', link: 'https://x.example/a', publishedAt: '2026-02-01T00:00:00Z' },
    { guid: 'b', title: 'B', link: 'https://x.example/b', publishedAt: '2026-02-02T00:00:00Z' },
  ];
  assert.deepEqual((await api.post('/articles/bulk-insert', { feedId: feed.id, articles })).body, { inserted: 2 });
  assert.deepEqual((await api.post('/articles/bulk-insert', { feedId: feed.id, articles })).body, { inserted: 0 });
  assert.equal((await api.post('/articles/bulk-insert', { feedId: feed.id })).status, 400);
  assert.equal((await api.post('/articles/bulk-insert', { articles })).status, 400);
  const unknownFeed = await api.post('/articles/bulk-insert', { feedId: 999999, articles: [{ guid: 'z', title: 'Z' }] });
  assert.equal(unknownFeed.status, 404);
});

test('articles: read by id and by link, update one, update many', async () => {
  const feed = await newFeed();
  const [newest, older] = await addArticles(feed.id, 2);
  const article = (await api.get(`/articles/${newest}`)).body;
  assert.equal(article.feedId, feed.id);
  assert.match(article.content, /Body of story 1/);
  assert.equal((await api.get('/articles/abc')).status, 400);
  assert.equal((await api.get('/articles/999999')).status, 404);

  assert.equal((await api.get(`/articles/by-link?url=${encodeURIComponent(article.link)}`)).body.id, newest);
  assert.equal((await api.get('/articles/by-link')).status, 400);
  assert.equal((await api.get('/articles/by-link?url=https%3A%2F%2Fnowhere.example%2F')).status, 404);

  const noted = (await api.put(`/articles/${older}`, { isRead: 1, note: ' worth a reread ' })).body;
  assert.equal(noted.isRead, 1);
  assert.equal(noted.note, 'worth a reread');
  assert.equal(noted.isBookmarked, 1, 'a note saves the article');
  assert.equal((await api.put('/articles/abc', { isRead: 1 })).status, 400);
  assert.equal((await api.put('/articles/999999', { isRead: 1 })).status, 404);

  assert.deepEqual((await api.put('/articles/bulk-update', { ids: [newest, older], isRead: 1 })).body, { ok: true });
  assert.equal((await api.get(`/articles/${newest}`)).body.isRead, 1);
  assert.equal((await api.put('/articles/bulk-update', { ids: [], isRead: 1 })).status, 400);
  assert.equal((await api.put('/articles/bulk-update', { isRead: 1 })).status, 400);
});

test('pages of a view: browse, search, AI filters and invalid views', async () => {
  const feed = await newFeed();
  const ids = await addArticles(feed.id, 3, (i) => ({ title: i === 0 ? 'Quantum chips arrive' : `Story ${i}` }));
  const page = (await api.get(`/articles/page?view=feed&id=${feed.id}&limit=2`)).body;
  assert.equal(page.articles.length, 2);
  assert.equal(page.total, 3);
  assert.equal(page.unread, 3);
  assert.equal(page.nextOffset, 2);
  assert.equal((await api.get(`/articles/page?view=feed&id=${feed.id}&offset=2`)).body.nextOffset, null);

  const found = (await api.get(`/articles/page?view=feed&id=${feed.id}&q=quantum`)).body;
  assert.deepEqual(found.articles.map((a) => a.title), ['Quantum chips arrive']);

  const analysis = JSON.stringify({ sentiment: 'positive' });
  await api.put(`/articles/${ids[1]}`, { aiStatus: 'done', aiAnalysis: analysis });
  const filtered = (await api.get(`/articles/page?view=feed&id=${feed.id}&aiOnly=1&sentiment=positive`)).body;
  assert.deepEqual(filtered.articles.map((a) => a.id), [ids[1]]);
  assert.deepEqual(filtered.facets.sentiment, ['positive']);

  assert.equal((await api.get('/articles/page?view=feed')).status, 400, 'a feed view needs an id');
  assert.equal((await api.get('/articles/page?view=everything')).status, 400);
  assert.equal((await api.get('/articles/page')).status, 200, 'the default view is all');
});

test('marking a view read updates the unread counts', async () => {
  const feed = await newFeed();
  await addArticles(feed.id, 2);
  const before = (await api.get('/articles/counts')).body;
  assert.equal(before.unreadByFeed[feed.id], 2);
  assert.ok(before.total >= 2);
  assert.equal(typeof before.savedCount, 'number');

  assert.deepEqual((await api.post('/articles/mark-view-read', { view: 'feed', id: feed.id })).body, { changed: 2 });
  assert.equal((await api.get('/articles/counts')).body.unreadByFeed[feed.id], undefined);
  assert.deepEqual((await api.post('/articles/mark-view-read', { view: 'feed', id: feed.id })).body, { changed: 0 });
  assert.equal((await api.post('/articles/mark-view-read', { view: 'nowhere' })).status, 400);
  assert.equal((await api.post('/articles/mark-view-read', {})).status, 200, 'no view means all');
});

test('the AI queue: queue count, claims and reset', async () => {
  const feed = await newFeed();
  const [newest, , oldest] = await addArticles(feed.id, 3);

  await api.put('/articles/bulk-update', { ids: [newest, oldest], aiStatus: 'queued' });
  assert.deepEqual((await api.get('/articles/queue-count')).body, { count: 2 });
  assert.deepEqual((await api.get('/articles/by-ai-status?status=queued,processing')).body.map((a) => a.id), [newest, oldest]);
  assert.equal((await api.get('/articles/by-ai-status')).status, 400);

  const first = (await api.post('/articles/claim-next')).body;
  assert.equal(first.article.id, newest);
  assert.equal(first.article.aiStatus, 'processing');
  assert.equal(first.queued, 2);
  // A fresh claim belongs to a tab still working on it, so a reset leaves it alone.
  assert.deepEqual((await api.post('/articles/reset-processing')).body, { ok: true });
  assert.equal((await api.get(`/articles/${newest}`)).body.aiStatus, 'processing');

  assert.equal((await api.post('/articles/claim-next')).body.article.id, oldest);
  assert.deepEqual((await api.post('/articles/claim-next')).body, { article: null, queued: 0 });
});

test('a value the database cannot store is a 500 with the reason', async () => {
  const folder = (await api.post('/folders', { name: 'Typed' })).body;
  const res = await api.put(`/folders/${folder.id}`, { name: { nested: true } });
  assert.equal(res.status, 500);
  assert.match(res.body.error, /bind/i);
});

test('the database path is in the data directory, and clearing it removes everything', async () => {
  assert.equal((await api.get('/db-path')).body.path, join(dataDir, 'reader.db'));
  await newFeed();
  assert.deepEqual((await api.delete('/all')).body, { ok: true });
  assert.deepEqual((await api.get('/feeds')).body, []);
  assert.deepEqual((await api.get('/folders')).body, []);
  assert.equal((await api.get('/articles/counts')).body.total, 0);
});
