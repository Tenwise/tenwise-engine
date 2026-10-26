import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let reader;
let pages;
before(async () => {
  // Point the db layer at a throwaway directory before it opens anything.
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-bulk-'));
  reader = await import('./reader.js');
  pages = await import('./articlePages.js');
});

test('bulk updates work past SQLite\'s 32,766-variable limit', () => {
  const feed = reader.createFeed({ title: 'Big', url: 'https://big.example/rss' });
  const items = Array.from({ length: 40000 }, (_, i) => ({ guid: `g${i}`, title: `Item ${i}`, summary: '', content: '' }));
  assert.equal(reader.bulkInsertArticles(feed.id, items), 40000);
  const ids = pages.getArticlePage('feed', feed.id).articles.map((a) => a.id);
  assert.doesNotThrow(() => reader.bulkUpdateArticles(ids, { isRead: 1 }));
  assert.equal(pages.getArticlePage('feed', feed.id).articles.filter((a) => !a.isRead).length, 0);
});

test('read and bookmark flags accept booleans', () => {
  const feed = reader.createFeed({ title: 'Flags', url: 'https://flags.example/rss' });
  reader.bulkInsertArticles(feed.id, [{ guid: 'f1', title: 'F', summary: '', content: '' }]);
  const [article] = pages.getArticlePage('feed', feed.id).articles;
  assert.equal(reader.updateArticle(article.id, { isBookmarked: true }).isBookmarked, 1);
  reader.bulkUpdateArticles([article.id], { isRead: true, isBookmarked: false });
  const updated = reader.getArticleById(article.id);
  assert.equal(updated.isRead, 1);
  assert.equal(updated.isBookmarked, 0);
});
