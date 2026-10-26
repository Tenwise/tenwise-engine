import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let reader;
let pages;
let db;
let feedA;
let feedB;

const titles = (page) => page.articles.map((a) => a.title);

before(async () => {
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-pages-'));
  reader = await import('./reader.js');
  pages = await import('./articlePages.js');
  ({ db } = await import('./database.js'));

  const folder = reader.createFolder({ name: 'Tech' });
  feedA = reader.createFeed({ title: 'Cloud Weekly', url: 'https://a.example/rss', folderId: folder.id });
  feedB = reader.createFeed({ title: 'Garden News', url: 'https://b.example/rss' });
  const day = (n) => `2026-10-${String(n).padStart(2, '0')}T00:00:00Z`;
  reader.bulkInsertArticles(feedA.id, [1, 2, 3, 4, 5].map((n) => ({
    guid: `a${n}`, title: `Alpha ${n}`, summary: '', content: n === 2 ? 'kubernetes deep dive' : '', publishedAt: day(n),
  })));
  reader.bulkInsertArticles(feedB.id, [
    { guid: 'b1', title: 'Tomatoes and cloud cover', summary: '', content: '', publishedAt: day(6) },
    { guid: 'b2', title: 'Roses', summary: '', content: '', publishedAt: day(7) },
  ]);
  const set = db.prepare("UPDATE articles SET ai_status = 'done', ai_analysis = ? WHERE guid = ?");
  set.run(JSON.stringify({ sentiment: 'positive', tone: 'optimistic' }), 'a1');
  set.run(JSON.stringify({ sentiment: 'negative' }), 'b2');
  set.run('{not json', 'a3');
  db.prepare("UPDATE articles SET is_read = 1 WHERE guid IN ('a4', 'a5')").run();
});

test('pages through a view newest first, with totals and the next offset', () => {
  const first = pages.getArticlePage('all', undefined, { limit: 3 });
  assert.deepEqual(titles(first), ['Roses', 'Tomatoes and cloud cover', 'Alpha 5']);
  assert.equal(first.total, 7);
  assert.equal(first.unread, 5);
  assert.equal(first.nextOffset, 3);

  const last = pages.getArticlePage('all', undefined, { offset: 6, limit: 3 });
  assert.deepEqual(titles(last), ['Alpha 1']);
  assert.equal(last.nextOffset, null);
});

test('scopes to a feed or folder', () => {
  assert.equal(pages.getArticlePage('feed', feedB.id).total, 2);
  const folder = pages.getArticlePage('folder', feedA.folderId);
  assert.equal(folder.total, 5);
  assert.equal(folder.unread, 3);
});

test('filters on AI analysis in SQL, ignoring malformed analysis', () => {
  const positive = pages.getArticlePage('all', undefined, { filters: { sentiment: 'positive' } });
  assert.deepEqual(titles(positive), ['Alpha 1']);
  assert.equal(pages.getArticlePage('all', undefined, { aiOnly: true }).total, 3);
  const { facets } = pages.getArticlePage('all');
  assert.deepEqual(facets.sentiment.sort(), ['negative', 'positive']);
  assert.deepEqual(facets.tone, ['optimistic']);
});

test('search ranks title over source over body and pages the ranked list', () => {
  const page = pages.getArticlePage('all', undefined, { q: 'cloud' });
  // "Tomatoes and cloud cover" matches by title; the Alpha articles by source.
  assert.equal(page.articles[0].title, 'Tomatoes and cloud cover');
  assert.equal(page.total, 6);
  const body = pages.getArticlePage('all', undefined, { q: 'kubernetes' });
  assert.deepEqual(titles(body), ['Alpha 2']);
});

test('search combines with filters and reports facets of the matches', () => {
  const page = pages.getArticlePage('all', undefined, { q: 'alpha', filters: { sentiment: 'positive' } });
  assert.deepEqual(titles(page), ['Alpha 1']);
  assert.deepEqual(page.facets.sentiment, ['positive']);
});

test('clamps the page size', () => {
  assert.equal(pages.getArticlePage('all', undefined, { limit: 0 }).articles.length, 1);
  assert.equal(pages.getArticlePage('all', undefined, { limit: 10_000 }).articles.length, 7);
});

test('marks a whole view read', () => {
  assert.equal(pages.markViewRead('feed', feedB.id), 2);
  assert.equal(pages.getArticlePage('feed', feedB.id).unread, 0);
  assert.equal(pages.getArticlePage('all').unread, 3);
});
