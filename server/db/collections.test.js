import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let reader;
let pages;
let collections;
before(async () => {
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-collections-'));
  reader = await import('./reader.js');
  pages = await import('./articlePages.js');
  collections = await import('./collections.js');
});

let feedCount = 0;
function addArticles(n) {
  feedCount += 1;
  const feed = reader.createFeed({ title: `C ${feedCount}`, url: `https://c${feedCount}.example/rss` });
  reader.bulkInsertArticles(feed.id, Array.from({ length: n }, (_, i) => ({ guid: `c${feedCount}-${i}`, title: `Item ${i}`, summary: '', content: '' })));
  return { feedId: feed.id, ids: pages.getArticlePage('feed', feed.id).articles.map((a) => a.id) };
}

test('collections are created, renamed and listed by name with counts', () => {
  const evals = collections.createCollection({ name: 'Agent Evals' });
  collections.createCollection({ name: 'cost curves', description: 'Inference economics' });
  assert.deepEqual(collections.listCollections().map((c) => [c.name, c.count]), [['Agent Evals', 0], ['cost curves', 0]]);
  const renamed = collections.updateCollection(evals.id, { name: 'Agent evaluation' });
  assert.equal(renamed.name, 'Agent evaluation');
  assert.equal(collections.updateCollection(99999, { name: 'x' }), null);
});

test('names are unique, ignoring case', () => {
  collections.createCollection({ name: 'Unique One' });
  assert.throws(() => collections.createCollection({ name: 'unique one' }), collections.DuplicateNameError);
});

test('adding saves the article; an article can be in several collections', () => {
  const { ids: [id] } = addArticles(1);
  const a = collections.createCollection({ name: 'A' });
  const b = collections.createCollection({ name: 'B' });
  assert.equal(collections.addToCollection(a.id, [id, 424242]).count, 1); // unknown ids are skipped
  collections.addToCollection(b.id, [id]);
  collections.addToCollection(b.id, [id]); // twice is once
  const article = reader.getArticleById(id);
  assert.equal(article.isBookmarked, 1);
  assert.ok(article.savedAt);
  assert.deepEqual(collections.collectionsOfArticle(id), [a.id, b.id]);
  assert.deepEqual(pages.getArticlePage('collection', b.id).articles.map((x) => x.id), [id]);
});

test('removing keeps the save; unsaving leaves every collection', () => {
  const { ids: [one, two] } = addArticles(2);
  const c = collections.createCollection({ name: 'C' });
  collections.addToCollection(c.id, [one, two]);
  collections.removeFromCollection(c.id, [one]);
  assert.equal(reader.getArticleById(one).isBookmarked, 1);
  reader.updateArticle(two, { isBookmarked: 0 });
  assert.deepEqual(collections.collectionsOfArticle(two), []);
  assert.equal(collections.getCollection(c.id).count, 0);
});

test('deleting a collection keeps its articles saved; removing their feed keeps them in collections', () => {
  const { feedId, ids: [one, two] } = addArticles(2);
  const d = collections.createCollection({ name: 'D' });
  const e = collections.createCollection({ name: 'E' });
  collections.addToCollection(d.id, [one]);
  collections.addToCollection(e.id, [two]);
  assert.equal(collections.deleteCollection(d.id), true);
  assert.equal(reader.getArticleById(one).isBookmarked, 1);
  reader.removeFeed(feedId);
  assert.equal(collections.getCollection(e.id).count, 1);
});

test('Unsorted lists saves that are in no collection, latest save first', async () => {
  const { ids: [one, two, three] } = addArticles(3);
  const f = collections.createCollection({ name: 'F' });
  reader.updateArticle(one, { isBookmarked: 1 });
  await new Promise((resolve) => { setTimeout(resolve, 5); });
  reader.updateArticle(two, { isBookmarked: 1 });
  collections.addToCollection(f.id, [three]);
  const unsorted = pages.getArticlePage('unsorted').articles.map((a) => a.id);
  assert.deepEqual(unsorted.slice(0, 2), [two, one]);
  assert.ok(!unsorted.includes(three));
  assert.equal(reader.getCounts().unsortedCount, pages.getArticlePage('unsorted').total);
  collections.addToCollection(f.id, [two]);
  assert.ok(!pages.getArticlePage('unsorted').articles.some((a) => a.id === two));
});
