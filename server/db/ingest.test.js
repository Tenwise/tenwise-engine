import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { canonicalizeUrl } from '../../shared/feedItems.js';

let reader;
let pages;
before(async () => {
  // Point the db layer at a throwaway directory before it opens anything.
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-ingest-'));
  reader = await import('./reader.js');
  pages = await import('./articlePages.js');
});

// An article as it is stored (toArticle in shared/feedItems.js).
const item = (fields) => ({ title: 'T', summary: '', content: '', ...fields, canonicalLink: canonicalizeUrl(fields.link || '') });
const newFeed = (name) => reader.createFeed({ title: name, url: `https://${name}.example/rss` });

test('changelog-style links that differ only by #fragment are separate articles', () => {
  const feed = newFeed('changelog');
  assert.equal(reader.bulkInsertArticles(feed.id, [item({ guid: 'v1.3', link: 'https://e.com/changelog#v1.3' })]), 1);
  assert.equal(reader.bulkInsertArticles(feed.id, [item({ guid: 'v1.4', link: 'https://e.com/changelog#v1.4' })]), 1);
});

test('the same article from another feed is still skipped', () => {
  const a = newFeed('first');
  const b = newFeed('second');
  assert.equal(reader.bulkInsertArticles(a.id, [item({ guid: 'a1', link: 'https://news.example/story?utm_source=rss' })]), 1);
  assert.equal(reader.bulkInsertArticles(b.id, [item({ guid: 'b1', link: 'https://www.news.example/story' })]), 0);
});

test('duplicates inside one batch are inserted once', () => {
  const feed = newFeed('batch');
  const inserted = reader.bulkInsertArticles(feed.id, [
    item({ guid: 'x1', link: 'https://dup.example/a' }),
    item({ guid: 'x2', link: 'https://dup.example/a?utm_campaign=z' }),
    item({ guid: 'x1', link: 'https://dup.example/other' }),
  ]);
  assert.equal(inserted, 1);
});

test('items with no guid and no link are all stored, and not re-stored on refresh', () => {
  const feed = newFeed('noids');
  const batch = [item({ guid: '', title: 'First' }), item({ guid: '', title: 'Second' })];
  assert.equal(reader.bulkInsertArticles(feed.id, batch), 2);
  assert.equal(reader.bulkInsertArticles(feed.id, batch), 0);
});

test('unreadable dates are stored as the insert time, never as raw text', () => {
  const feed = newFeed('dates');
  reader.bulkInsertArticles(feed.id, [
    item({ guid: 'd1', link: 'https://d.example/1', publishedAt: 'Sat, 18 Oct 2026 10:00:00 IST' }),
    item({ guid: 'd2', link: 'https://d.example/2', publishedAt: 'Mon, 01 Jan 2001 10:00:00 XYZT' }),
  ]);
  const dates = pages.getArticlePage('feed', feed.id).articles.map((a) => a.publishedAt);
  assert.ok(dates.includes('2026-10-18T04:30:00.000Z'));
  assert.ok(dates.every((d) => /^\d{4}-\d{2}-\d{2}T/.test(d)), dates.join(', '));
});
