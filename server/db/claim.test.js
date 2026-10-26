import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let reader;
let pages;
before(async () => {
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-claim-'));
  reader = await import('./reader.js');
  pages = await import('./articlePages.js');
});

const statusOf = (id) => reader.getArticleById(id).aiStatus;

test('each queued article is claimed once, newest first', () => {
  const feed = reader.createFeed({ title: 'Q', url: 'https://q.example/rss' });
  reader.bulkInsertArticles(feed.id, [
    { guid: 'old', title: 'Old', summary: '', content: '', publishedAt: '2026-10-01T00:00:00Z' },
    { guid: 'new', title: 'New', summary: '', content: '', publishedAt: '2026-10-18T00:00:00Z' },
  ]);
  const ids = pages.getArticlePage('feed', feed.id).articles.map((a) => a.id);
  reader.bulkUpdateArticles(ids, { aiStatus: 'queued' });

  // Two tabs asking at once get different articles.
  const first = reader.claimNextQueued();
  const second = reader.claimNextQueued();
  assert.equal(first.article.title, 'New');
  assert.equal(first.queued, 2);
  assert.equal(second.article.title, 'Old');
  assert.equal(statusOf(first.article.id), 'processing');
  assert.deepEqual(reader.claimNextQueued(), { article: null, queued: 0 });
});

test('a new tab only re-queues stale claims, not ones being worked on', () => {
  const feed = reader.createFeed({ title: 'R', url: 'https://r.example/rss' });
  reader.bulkInsertArticles(feed.id, [{ guid: 'a', title: 'A', summary: '', content: '' }, { guid: 'b', title: 'B', summary: '', content: '' }]);
  const ids = pages.getArticlePage('feed', feed.id).articles.map((a) => a.id);
  reader.bulkUpdateArticles(ids, { aiStatus: 'queued' });
  const t0 = Date.now();
  const busy = reader.claimNextQueued(t0).article;     // a tab is working on this one
  const crashed = reader.claimNextQueued(t0 - 60 * 60 * 1000).article; // claimed an hour ago, then abandoned

  reader.resetProcessingToQueued(t0 + 1000);
  assert.equal(statusOf(busy.id), 'processing');
  assert.equal(statusOf(crashed.id), 'queued');
});
