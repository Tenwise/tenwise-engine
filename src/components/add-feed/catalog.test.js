import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoriesFor, getDomain, searchCatalog } from './catalog.js';

const catalog = [
  { category: 'AI', emoji: '🤖', feeds: [{ title: 'Model Weekly', url: 'a', description: 'LLM news' }, { title: 'Robots', url: 'b' }] },
  { category: 'Design', emoji: '🎨', feeds: [{ title: 'Pixels', url: 'c', description: 'UI and AI tools' }] },
];

test('searchCatalog matches title, description, or category, case-insensitively', () => {
  assert.deepEqual(searchCatalog('ai', catalog).map((r) => r.feed.url), ['a', 'b', 'c']);
  assert.deepEqual(searchCatalog('PIXEL', catalog).map((r) => [r.feed.url, r.category, r.emoji]), [['c', 'Design', '🎨']]);
  assert.deepEqual(searchCatalog('  ', catalog), []);
});

test('categoriesFor and getDomain', () => {
  assert.equal(categoriesFor('all', catalog), catalog);
  assert.deepEqual(categoriesFor('Design', catalog).map((c) => c.category), ['Design']);
  assert.equal(getDomain('https://www.example.com/path'), 'example.com');
  assert.equal(getDomain('not a url'), 'not a url');
});
