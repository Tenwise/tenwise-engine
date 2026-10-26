import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let reader;
before(async () => {
  // Point the db layer at a throwaway directory before it opens anything.
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-search-'));
  reader = await import('./reader.js');
  const feed = reader.createFeed({ title: 'Feed', url: 'https://example.com/rss' });
  reader.bulkInsertArticles(feed.id, [
    { guid: 'k8s', title: 'Ops notes', summary: '', content: '<p>Running <b>Kubernetes</b> clusters at scale.</p>' },
    { guid: 'cloud', title: 'Cloud', summary: 'Clouds and costs', content: '' },
    { guid: 'oss', title: 'Licensing', summary: '', content: 'Thoughts on open source licensing.' },
  ]);
});

const titlesFor = (ids) => ids.map((id) => reader.getArticleById(id).title).sort();
// Body matches for a single-term query.
const bodyIds = (query) => reader.searchArticleBodies(query).matches[0];

test('finds terms anywhere in the article body, including inside HTML', () => {
  assert.deepEqual(titlesFor(bodyIds('kubernetes')), ['Ops notes']);
});

test('single words match as prefixes; phrases match exactly', () => {
  assert.deepEqual(titlesFor(bodyIds('cloud')), ['Cloud']);
  assert.deepEqual(titlesFor(bodyIds('"open source"')), ['Licensing']);
  assert.deepEqual(bodyIds('"source open"'), []);
});

test('terms are never used as object keys (prototype safety)', () => {
  const result = reader.searchArticleBodies('__proto__ constructor');
  assert.deepEqual(result.tokens, ['__proto__', 'constructor']);
  assert.ok(Array.isArray(result.matches) && result.matches.length === 2);
  assert.equal({}.polluted, undefined);
});

test('quotes and FTS syntax in queries are treated as plain text', () => {
  assert.doesNotThrow(() => reader.searchArticleBodies('AND OR NOT ( ) * "unterminated'));
});

test('deleted articles leave the index', () => {
  const feed = reader.createFeed({ title: 'Temp', url: 'https://temp.example/rss' });
  reader.bulkInsertArticles(feed.id, [{ guid: 'gone', title: 'Gone', content: 'zeppelin' }]);
  assert.equal(bodyIds('zeppelin').length, 1);
  reader.removeFeed(feed.id);
  assert.deepEqual(bodyIds('zeppelin'), []);
});
