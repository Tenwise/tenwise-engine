import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPlugins } from '../../plugins/index.js';
import { categoriesFor, getDomain, isCatalog, loadCatalog, POPULAR_FEEDS, resetCatalog, searchCatalog } from './catalog.js';

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

const stored = [{ id: 'pm', category: 'Product', feeds: [{ title: 'Lenny', url: 'https://www.lennysnewsletter.com/feed' }] }];

test('the built-in catalog: categories with ids, five or more feeds each, no feed twice in a category', () => {
  assert.ok(isCatalog(POPULAR_FEEDS));
  for (const c of POPULAR_FEEDS) {
    assert.ok(c.feeds.length >= 5, c.id);
    assert.equal(new Set(c.feeds.map((f) => f.url)).size, c.feeds.length, c.id);
  }
});

test('a plugin’s catalog replaces the built-in; it is asked once', async (t) => {
  t.after(() => { setPlugins(null); resetCatalog(); });
  let asked = 0;
  setPlugins([{ feedCatalog: [{ id: 'none', load: async () => null }, { id: 'stored', load: async () => { asked += 1; return stored; } }] }]);
  resetCatalog();
  assert.equal(await loadCatalog(), stored);
  assert.equal(await loadCatalog(), stored);
  assert.equal(asked, 1);
  assert.deepEqual(searchCatalog('lenny', await loadCatalog()).map((r) => r.category), ['Product']);
});

test('a plugin that fails or answers with no catalog leaves the built-in', async (t) => {
  t.after(() => { setPlugins(null); resetCatalog(); });
  for (const load of [async () => { throw new Error('offline'); }, async () => [], async () => [{ id: 'x' }]]) {
    setPlugins([{ feedCatalog: [{ id: 'p', load }] }]);
    resetCatalog();
    assert.equal(await loadCatalog(), POPULAR_FEEDS);
  }
});
