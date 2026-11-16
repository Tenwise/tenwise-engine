import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { muteCondition } from '../../shared/rules.js';

let reader;
let pages;
let settingsPath;
let feedA;
let feedB;

const titles = (page) => page.articles.map((a) => a.title).sort();
const setRules = (rules) => writeFileSync(settingsPath, JSON.stringify({ 'tenwise-rules': JSON.stringify(rules) }));

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tenwise-rules-'));
  process.env.TENWISE_DATA_DIR = dir;
  settingsPath = join(dir, 'settings.json');
  reader = await import('./reader.js');
  pages = await import('./articlePages.js');
  const folder = reader.createFolder({ name: 'Tech' });
  feedA = reader.createFeed({ title: 'Tech Daily', url: 'https://a.example/rss', folderId: folder.id });
  feedB = reader.createFeed({ title: 'Promo Feed', url: 'https://b.example/rss' });
  const now = new Date().toISOString();
  reader.bulkInsertArticles(feedA.id, [
    { guid: 'a1', title: 'Crypto prices fall again', summary: '', content: '', publishedAt: now },
    { guid: 'a2', title: 'Open source AI model released', summary: '', content: '', publishedAt: now },
    { guid: 'a3', title: 'She said the cryptography talk was great', summary: '', content: '', publishedAt: now },
  ]);
  reader.bulkInsertArticles(feedB.id, [{ guid: 'b1', title: 'Big sale today', summary: '', content: '', publishedAt: now }]);
  const saved = pages.getArticlePage('all', null).articles.find((a) => a.title.startsWith('Crypto'));
  reader.updateArticle(saved.id, { isBookmarked: true });
});

beforeEach(() => setRules({}));

test('a muted word hides matching articles in every reading view, as a whole word', () => {
  setRules({ muteWords: ['crypto'] });
  for (const [view, id] of [['all', null], ['today', null], ['feed', feedA.id], ['folder', 1]]) {
    assert.ok(!titles(pages.getArticlePage(view, id)).includes('Crypto prices fall again'), view);
  }
  assert.ok(titles(pages.getArticlePage('all', null)).includes('She said the cryptography talk was great'), '"cryptography" is another word');
});

test('a muted feed is hidden; saves keep what you saved', () => {
  setRules({ muteFeeds: [feedB.id], muteWords: ['crypto'] });
  assert.ok(!titles(pages.getArticlePage('all', null)).includes('Big sale today'));
  assert.deepEqual(titles(pages.getArticlePage('saved', null)), ['Crypto prices fall again']);
});

test('counts leave muted articles out, so the sidebar agrees with the list', () => {
  const before = reader.getCounts();
  setRules({ muteFeeds: [feedB.id], muteWords: ['crypto'] });
  const after = reader.getCounts(muteCondition(pages.currentRules()));
  assert.equal(before.unreadByFeed[feedB.id], 1);
  assert.equal(after.unreadByFeed[feedB.id], undefined);
  assert.equal(after.total, before.total - 2);
});

test('an alert word marks the articles it matches', () => {
  setRules({ alertWords: ['ai'] });
  const page = pages.getArticlePage('all', null);
  assert.equal(page.articles.find((a) => a.title.startsWith('Open source')).alert, 'ai');
  assert.equal(page.articles.find((a) => a.title.startsWith('She said')).alert, undefined);
});

test('marking a view read leaves muted articles alone', () => {
  setRules({ muteWords: ['crypto'] });
  pages.markViewRead('feed', feedA.id);
  setRules({});
  const crypto = pages.getArticlePage('feed', feedA.id).articles.find((a) => a.title.startsWith('Crypto'));
  assert.ok(!crypto.isRead, 'still unread');
});
