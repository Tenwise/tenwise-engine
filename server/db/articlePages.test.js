import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let reader;
let pages;
let db;
let feedA;
let feedB;

const titles = (page) => page.articles.map((a) => a.title);

before(async () => {
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-pages-'));
  reader = await import('./reader.js');
  pages = await import('./articlePages.js');
  ({ db } = await import('./database.js'));

  const folder = reader.createFolder({ name: 'Tech' });
  feedA = reader.createFeed({ title: 'Cloud Weekly', url: 'https://a.example/rss', folderId: folder.id });
  feedB = reader.createFeed({ title: 'Garden News', url: 'https://b.example/rss' });
  const day = (n) => `2026-10-${String(n).padStart(2, '0')}T00:00:00Z`;
  reader.bulkInsertArticles(feedA.id, [1, 2, 3, 4, 5].map((n) => ({
    guid: `a${n}`, title: `Alpha ${n}`, summary: '', content: n === 2 ? 'kubernetes deep dive' : '', publishedAt: day(n),
  })));
  reader.bulkInsertArticles(feedB.id, [
    { guid: 'b1', title: 'Tomatoes and cloud cover', summary: '', content: '', publishedAt: day(6) },
    { guid: 'b2', title: 'Roses', summary: '', content: '', publishedAt: day(7) },
  ]);
  const set = db.prepare("UPDATE articles SET ai_status = 'done', ai_analysis = ? WHERE guid = ?");
  set.run(JSON.stringify({ sentiment: 'positive', tone: 'optimistic' }), 'a1');
  set.run(JSON.stringify({ sentiment: 'negative' }), 'b2');
  set.run('{not json', 'a3');
  db.prepare("UPDATE articles SET is_read = 1 WHERE guid IN ('a4', 'a5')").run();
});

test('pages through a view newest first, with totals and the next offset', () => {
  const first = pages.getArticlePage('all', undefined, { limit: 3 });
  assert.deepEqual(titles(first), ['Roses', 'Tomatoes and cloud cover', 'Alpha 5']);
  assert.equal(first.total, 7);
  assert.equal(first.unread, 5);
  assert.equal(first.nextOffset, 3);

  const last = pages.getArticlePage('all', undefined, { offset: 6, limit: 3 });
  assert.deepEqual(titles(last), ['Alpha 1']);
  assert.equal(last.nextOffset, null);
});

test('scopes to a feed or folder', () => {
  assert.equal(pages.getArticlePage('feed', feedB.id).total, 2);
  const folder = pages.getArticlePage('folder', feedA.folderId);
  assert.equal(folder.total, 5);
  assert.equal(folder.unread, 3);
});

test('filters on AI analysis in SQL, ignoring malformed analysis', () => {
  const positive = pages.getArticlePage('all', undefined, { filters: { sentiment: 'positive' } });
  assert.deepEqual(titles(positive), ['Alpha 1']);
  assert.equal(pages.getArticlePage('all', undefined, { aiOnly: true }).total, 3);
  const { facets } = pages.getArticlePage('all');
  assert.deepEqual(facets.sentiment.sort(), ['negative', 'positive']);
  assert.deepEqual(facets.tone, ['optimistic']);
});

test('search ranks title over source over body and pages the ranked list', () => {
  const page = pages.getArticlePage('all', undefined, { q: 'cloud' });
  // "Tomatoes and cloud cover" matches by title; the Alpha articles by source.
  assert.equal(page.articles[0].title, 'Tomatoes and cloud cover');
  assert.equal(page.total, 6);
  const body = pages.getArticlePage('all', undefined, { q: 'kubernetes' });
  assert.deepEqual(titles(body), ['Alpha 2']);
});

test('search combines with filters and reports facets of the matches', () => {
  const page = pages.getArticlePage('all', undefined, { q: 'alpha', filters: { sentiment: 'positive' } });
  assert.deepEqual(titles(page), ['Alpha 1']);
  assert.deepEqual(page.facets.sentiment, ['positive']);
});

test('clamps the page size', () => {
  assert.equal(pages.getArticlePage('all', undefined, { limit: 0 }).articles.length, 1);
  assert.equal(pages.getArticlePage('all', undefined, { limit: 10_000 }).articles.length, 7);
});

test('marks a whole view read', () => {
  assert.equal(pages.markViewRead('feed', feedB.id), 2);
  assert.equal(pages.getArticlePage('feed', feedB.id).unread, 0);
  assert.equal(pages.getArticlePage('all').unread, 3);
});

test('read: unread or read only, browsing and searching, with the right total (PR-12)', () => {
  const feed = reader.createFeed({ title: 'Read state', url: 'https://read.example/rss' });
  reader.bulkInsertArticles(feed.id, ['r1', 'r2', 'r3'].map((g) => ({ guid: g, title: `Read test ${g}`, summary: '', content: '', publishedAt: '2026-10-20T00:00:00Z' })));
  const all = pages.getArticlePage('feed', feed.id);
  reader.bulkUpdateArticles([all.articles.find((a) => a.title.endsWith('r2')).id], { isRead: 1 });
  const unread = pages.getArticlePage('feed', feed.id, { read: 'unread' });
  assert.deepEqual([unread.total, titles(unread).sort()], [2, ['Read test r1', 'Read test r3']]);
  const read = pages.getArticlePage('feed', feed.id, { read: 'read' });
  assert.deepEqual([read.total, titles(read)], [1, ['Read test r2']]);
  assert.equal(pages.getArticlePage('feed', feed.id, { read: 'nonsense' }).total, 3, 'anything else shows both');
  const searched = pages.getArticlePage('feed', feed.id, { q: 'read test', read: 'unread' });
  assert.deepEqual(titles(searched).sort(), ['Read test r1', 'Read test r3']);
  assert.equal(unread.unread, 2, 'the view\'s unread count is unchanged by the filter');
});

test('a saved rule filter is a view: title or full text, a folder, with read state (PR-13)', async () => {
  const { updateSettings } = await import('../settings.js');
  const tech = reader.listFolders().find((f) => f.name === 'Tech').id;
  updateSettings({
    'tenwise-rule-filters': JSON.stringify([
      { id: 1, name: 'Cloud', rule: 'cloud', scope: 'title' },
      { id: 2, name: 'K8s or roses', rule: 'kubernetes OR roses', scope: 'all' },
      { id: 3, name: 'Alpha', rule: 'alpha AND NOT "alpha 2"', scope: 'title', folderId: tech },
      { id: 4, name: 'K8s titles', rule: 'kubernetes', scope: 'title' },
    ]),
  });
  assert.deepEqual(titles(pages.getArticlePage('filter', 1)), ['Tomatoes and cloud cover']);
  assert.deepEqual(titles(pages.getArticlePage('filter', 2)).sort(), ['Alpha 2', 'Roses'], 'kubernetes is in a body');
  assert.deepEqual(titles(pages.getArticlePage('filter', 4)), [], 'title only: not found in a body');
  assert.deepEqual(titles(pages.getArticlePage('filter', 3)), ['Alpha 5', 'Alpha 4', 'Alpha 3', 'Alpha 1']);
  assert.deepEqual(titles(pages.getArticlePage('filter', 3, { read: 'unread' })), ['Alpha 3', 'Alpha 1']);
  assert.equal(pages.getArticlePage('filter', 99).total, 0, 'a filter that is gone shows nothing');
});

test('after: only what arrived after a visit, browsing and searching; a bad time shows all (GRO-22)', () => {
  const feed = reader.createFeed({ title: 'Since test', url: 'https://since.example/rss' });
  reader.bulkInsertArticles(feed.id, ['s1', 's2', 's3'].map((g) => ({ guid: g, title: `Since ${g}`, summary: '', content: '', publishedAt: '2026-10-20T00:00:00Z' })));
  const arrived = db.prepare('UPDATE articles SET created_at = ? WHERE guid = ?');
  arrived.run('2026-10-30T08:00:00.000Z', 's1');
  arrived.run('2026-10-31T09:00:00.000Z', 's2');
  arrived.run('2026-10-31T10:00:00.000Z', 's3');
  const after = '2026-10-31T00:00:00.000Z';
  const page = pages.getArticlePage('feed', feed.id, { after });
  assert.deepEqual([page.total, titles(page).sort()], [2, ['Since s2', 'Since s3']]);
  assert.equal(page.unread, 3, 'the view\'s unread count is the whole view\'s');
  assert.deepEqual(titles(pages.getArticlePage('feed', feed.id, { after, q: 'since' })).sort(), ['Since s2', 'Since s3']);
  assert.equal(pages.getArticlePage('feed', feed.id, { after: 'yesterday-ish' }).total, 3);
});

test('a feed narrowed to one author: its page, unread count and mark read; its authors, latest first', () => {
  const feed = reader.createFeed({ title: 'Inbox', url: 'https://inbox.example/rss' });
  reader.bulkInsertArticles(feed.id, [
    { guid: 'n1', title: 'Issue 1', author: 'Letter One', summary: '', content: '', publishedAt: '2026-10-21T00:00:00Z' },
    { guid: 'n2', title: 'Issue 2', author: 'Letter Two', summary: '', content: '', publishedAt: '2026-10-22T00:00:00Z' },
    { guid: 'n3', title: 'Issue 3', author: 'Letter One', summary: '', content: '', publishedAt: '2026-10-23T00:00:00Z' },
    { guid: 'n4', title: 'Issue 4', summary: '', content: '', publishedAt: '2026-10-24T00:00:00Z' },
  ]);
  const one = pages.getArticlePage('feed', feed.id, { author: 'Letter One' });
  assert.deepEqual([titles(one), one.total, one.unread], [['Issue 3', 'Issue 1'], 2, 2]);
  assert.equal(pages.getArticlePage('feed', feed.id).total, 4, 'no author: the whole feed');
  assert.equal(pages.getArticlePage('feed', feed.id, { author: 'Nobody' }).total, 0);
  assert.equal(pages.getArticlePage('all', undefined, { author: 'Letter One' }).total, pages.getArticlePage('all').total, 'only a feed is narrowed');
  assert.deepEqual(pages.feedAuthors(feed.id), [
    { author: 'Letter One', total: 2, unread: 2 },
    { author: 'Letter Two', total: 1, unread: 1 },
  ]);
  assert.equal(pages.markViewRead('feed', feed.id, 'Letter Two'), 1);
  assert.deepEqual(pages.feedAuthors(feed.id).map((a) => a.unread), [2, 0]);
  assert.equal(pages.getArticlePage('feed', feed.id).unread, 3);
});
