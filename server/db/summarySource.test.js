import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let reader;
let feed;
before(async () => {
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-summary-source-'));
  reader = await import('./reader.js');
  feed = reader.createFeed({ title: 'S', url: 'https://s.example/rss' });
});

let n = 0;
function newArticle() {
  n += 1;
  reader.bulkInsertArticles(feed.id, [{ guid: `g${n}`, title: `A${n}`, summary: '', content: '', publishedAt: '2026-10-19T00:00:00Z' }]);
  return reader.getArticleById(n);
}

test('a summary asked for in the reader is stored as manual', () => {
  const a = newArticle();
  const updated = reader.updateArticle(a.id, { aiSummary: 'Mine', aiSummarySource: 'manual' });
  assert.equal(updated.aiSummary, 'Mine');
  assert.equal(updated.aiSummarySource, 'manual');
});

test('the batch cannot replace a manual summary, but its other results still land', () => {
  const a = newArticle();
  reader.updateArticle(a.id, { aiSummary: 'Mine', aiSummarySource: 'manual' });
  const after = reader.updateArticle(a.id, { aiStatus: 'done', aiSummary: 'Batch', aiSummarySource: 'batch', aiAnalysis: '{"sentiment":"neutral"}' });
  assert.equal(after.aiSummary, 'Mine');
  assert.equal(after.aiSummarySource, 'manual');
  assert.equal(after.aiStatus, 'done');
  assert.equal(after.aiAnalysis, '{"sentiment":"neutral"}');
});

test('a change with no source cannot replace a manual summary either', () => {
  const a = newArticle();
  reader.updateArticle(a.id, { aiSummary: 'Mine', aiSummarySource: 'manual' });
  assert.equal(reader.updateArticle(a.id, { aiSummary: 'Other' }).aiSummary, 'Mine');
});

test('a new manual summary replaces the old one; batch summaries are replaced freely', () => {
  const a = newArticle();
  reader.updateArticle(a.id, { aiSummary: 'Batch 1', aiSummarySource: 'batch' });
  assert.equal(reader.updateArticle(a.id, { aiSummary: 'Batch 2', aiSummarySource: 'batch' }).aiSummary, 'Batch 2');
  assert.equal(reader.updateArticle(a.id, { aiSummary: 'Mine', aiSummarySource: 'manual' }).aiSummary, 'Mine');
  assert.equal(reader.updateArticle(a.id, { aiSummary: 'Mine again', aiSummarySource: 'manual' }).aiSummary, 'Mine again');
});

test('an unknown source is stored as none', () => {
  const a = newArticle();
  assert.equal(reader.updateArticle(a.id, { aiSummary: 'X', aiSummarySource: 'robot' }).aiSummarySource, null);
});
