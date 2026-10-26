import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let reader;
let pages;
let collections;
before(async () => {
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-removal-'));
  reader = await import('./reader.js');
  pages = await import('./articlePages.js');
  collections = await import('./collections.js');
});

let n = 0;
function feedWith(count, folderId) {
  n += 1;
  const feed = reader.createFeed({ title: `Noisy ${n}`, url: `https://noisy${n}.example/rss`, folderId });
  reader.bulkInsertArticles(feed.id, Array.from({ length: count }, (_, i) => ({ guid: `n${n}-${i}`, title: `Post ${i}`, summary: '', content: '' })));
  return { feed, ids: pages.getArticlePage('feed', feed.id).articles.map((a) => a.id) };
}

test('removing a feed keeps its saves, notes and collections, under its name', () => {
  const { feed, ids: [kept, other, gone] } = feedWith(3);
  reader.updateArticle(kept, { note: 'the one idea worth keeping' });
  const c = collections.createCollection({ name: 'Keepers' });
  collections.addToCollection(c.id, [other]);
  assert.equal(reader.removeFeed(feed.id), 2);
  assert.equal(reader.getArticleById(gone), null);
  assert.equal(reader.getArticleById(kept).note, 'the one idea worth keeping');
  assert.equal(collections.getCollection(c.id).count, 1);
  assert.ok(!reader.listFeeds().some((f) => f.id === feed.id), 'hidden from the feed list');
  assert.equal(reader.listRemovedFeeds().find((f) => f.id === feed.id).title, feed.title);
  assert.equal(reader.getFeed(feed.id).title, feed.title, 'still named for the reader');
});

test('saves from a removed feed leave All, Today and the unread counts but stay in Saved', () => {
  const { feed, ids: [kept] } = feedWith(2);
  reader.updateArticle(kept, { isBookmarked: 1 });
  reader.removeFeed(feed.id);
  assert.ok(!pages.getArticlePage('all').articles.some((a) => a.id === kept));
  assert.ok(!pages.getArticlePage('today').articles.some((a) => a.id === kept));
  assert.equal(reader.getCounts().unreadByFeed[feed.id], undefined);
  assert.ok(pages.getArticlePage('saved').articles.some((a) => a.id === kept));
});

test('a feed with no saves is deleted outright', () => {
  const { feed } = feedWith(2);
  assert.equal(reader.removeFeed(feed.id), 0);
  assert.equal(reader.getFeed(feed.id), null);
});

test('deleting a folder with its feeds keeps their saves', () => {
  const folder = reader.createFolder({ name: 'Firehose' });
  const a = feedWith(2, folder.id);
  const b = feedWith(1, folder.id);
  reader.updateArticle(a.ids[0], { isBookmarked: 1 });
  assert.equal(reader.removeFolderAndFeedsById(folder.id), 1);
  assert.ok(reader.getArticleById(a.ids[0]));
  assert.equal(reader.getFeed(b.feed.id), null);
  assert.equal(reader.listRemovedFeeds().find((f) => f.id === a.feed.id).folderId, null);
});

test('subscribing again brings a removed feed back with its saves', () => {
  const { feed, ids: [kept] } = feedWith(2);
  reader.updateArticle(kept, { isBookmarked: 1 });
  reader.removeFeed(feed.id);
  const again = reader.createFeed({ title: 'Noisy, renamed', url: feed.url });
  assert.equal(again.id, feed.id);
  assert.equal(again.removedAt, null);
  assert.equal(again.title, 'Noisy, renamed');
  assert.ok(reader.listFeeds().some((f) => f.id === feed.id));
  assert.ok(pages.getArticlePage('all').articles.some((x) => x.id === kept));
  assert.throws(() => reader.createFeed({ title: 'x', url: feed.url }), /already exists/);
});
