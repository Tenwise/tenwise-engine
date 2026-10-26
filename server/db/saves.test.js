import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let reader;
let pages;
before(async () => {
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-saves-'));
  reader = await import('./reader.js');
  pages = await import('./articlePages.js');
});

let feedCount = 0;
function addArticles(n) {
  feedCount += 1;
  const feed = reader.createFeed({ title: `Saves ${feedCount}`, url: `https://saves${feedCount}.example/rss` });
  const items = Array.from({ length: n }, (_, i) => ({
    guid: `s${feedCount}-${i}`, title: `Item ${i}`, summary: '', content: '',
    publishedAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
  }));
  reader.bulkInsertArticles(feed.id, items);
  return pages.getArticlePage('feed', feed.id).articles.map((a) => a.id);
}

test('saving stamps saved_at once; unsaving clears it', () => {
  const [id] = addArticles(1);
  const saved = reader.updateArticle(id, { isBookmarked: 1 });
  assert.equal(saved.isBookmarked, 1);
  assert.ok(saved.savedAt);
  assert.equal(reader.updateArticle(id, { isBookmarked: true }).savedAt, saved.savedAt);
  const unsaved = reader.updateArticle(id, { isBookmarked: 0 });
  assert.equal(unsaved.isBookmarked, 0);
  assert.equal(unsaved.savedAt, null);
});

test('writing a note saves the article; clearing it keeps the save', () => {
  const [id] = addArticles(1);
  const noted = reader.updateArticle(id, { note: '  better phrasing of the scaling argument  ' });
  assert.equal(noted.note, 'better phrasing of the scaling argument');
  assert.equal(noted.isBookmarked, 1);
  assert.ok(noted.savedAt);
  const cleared = reader.updateArticle(id, { note: '   ' });
  assert.equal(cleared.note, null);
  assert.equal(cleared.isBookmarked, 1);
});

test('notes are capped in length', () => {
  const [id] = addArticles(1);
  assert.equal(reader.updateArticle(id, { note: 'x'.repeat(5000) }).note.length, 2000);
});

test('bulk save stamps saved_at and the Saved view lists the latest save first', async () => {
  const [a, b, c] = addArticles(3);
  reader.bulkUpdateArticles([a, b], { isBookmarked: 1 });
  assert.ok(reader.getArticleById(a).savedAt);
  await new Promise((resolve) => { setTimeout(resolve, 5); }); // a later millisecond
  reader.updateArticle(c, { isBookmarked: 1 });
  // c was saved last, so it leads even though a and b have other publication dates.
  const ids = pages.getArticlePage('saved').articles.map((x) => x.id);
  assert.equal(ids[0], c);
  assert.deepEqual(new Set(ids.slice(1, 3)), new Set([a, b]));
});

test('list rows carry the note and save time', () => {
  const [id] = addArticles(1);
  reader.updateArticle(id, { note: 'connects to the cost-curve piece' });
  const row = pages.getArticlePage('saved').articles.find((x) => x.id === id);
  assert.equal(row.note, 'connects to the cost-curve piece');
  assert.ok(row.savedAt);
});
