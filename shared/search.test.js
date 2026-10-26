import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeQuery, rankArticles } from './search.js';

const articles = [
  { id: 1, title: 'Cloud costs explained', excerpt: 'A primer.', feedId: 'a' },
  { id: 2, title: 'Weekly notes', excerpt: 'Cloud migration and AI tooling.', feedId: 'b' },
  { id: 3, title: 'Gardening', excerpt: 'Tomatoes.', feedId: 'a', aiAnalysis: JSON.stringify({ topics: ['AI', 'cloud'] }) },
  { id: 4, title: 'Unrelated', excerpt: 'Nothing here.', feedId: 'b' },
];
const sources = { a: 'Infra Weekly', b: 'Tech Blog' };
const sourceOf = (a) => sources[a.feedId];

test('tokenizeQuery keeps quoted phrases together and lowercases', () => {
  assert.deepEqual(tokenizeQuery('Cloud "open source" AI'), ['cloud', 'open source', 'ai']);
  assert.deepEqual(tokenizeQuery('   '), []);
});

test('ranks title › source › topics › body and requires every term', () => {
  const ids = rankArticles(articles, ['cloud'], { sourceOf }).map((a) => a.id);
  assert.deepEqual(ids, [1, 3, 2]); // title (10), topics (3), excerpt body (1)
  // Every term must match somewhere (title/source/topics/body are substring matches).
  assert.deepEqual(rankArticles(articles, ['cloud', 'migration'], { sourceOf }).map((a) => a.id), [2]);
});

test('matches the source title', () => {
  assert.deepEqual(rankArticles(articles, ['infra'], { sourceOf }).map((a) => a.id).sort(), [1, 3]);
});

test('full-text body matches from the index widen results beyond the excerpt', () => {
  const bodyMatches = new Map([['kubernetes', new Set([4])]]);
  assert.deepEqual(rankArticles(articles, ['kubernetes'], { sourceOf }).map((a) => a.id), []);
  assert.deepEqual(rankArticles(articles, ['kubernetes'], { sourceOf, bodyMatches }).map((a) => a.id), [4]);
});

test('empty query returns the articles unchanged', () => {
  assert.equal(rankArticles(articles, [], { sourceOf }), articles);
});
