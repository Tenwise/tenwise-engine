import { test } from 'node:test';
import assert from 'node:assert/strict';
import { articlesToCSV, BY_PUBLISHED, BY_SAVED, chunkRows, dayGroup, emptyStateText, flattenPages, groupingFor, isSaveList, patchPages, shortTime, viewTitle, withDayHeaders } from './listLogic.js';

test('viewTitle and emptyStateText', () => {
  assert.equal(viewTitle({ type: 'all' }), 'All Articles');
  assert.equal(viewTitle({ type: 'feed', name: 'HN' }), 'HN');
  assert.equal(viewTitle({ type: 'folder' }), 'Folder');
  assert.equal(viewTitle({ type: 'other' }), 'Articles');
  assert.equal(emptyStateText({ hasActiveFilters: true, searchQuery: 'x', viewType: 'saved' }).body, 'No articles match the active filters');
  assert.equal(emptyStateText({ searchQuery: 'ai', viewType: 'saved' }).body, 'No articles match "ai"');
  assert.equal(emptyStateText({ viewType: 'saved' }).title, 'Nothing saved yet');
  assert.equal(emptyStateText({ viewType: 'all' }).title, 'Your feed is empty');
  // A list that is empty because the server isn't answering says so, not "empty".
  assert.equal(emptyStateText({ serverDown: true, searchQuery: 'ai', viewType: 'all' }).title, "Can't load articles");
});

test('articlesToCSV quotes text fields when needed and neutralises formulas', () => {
  const csv = articlesToCSV(
    [
      { title: 'Say "hi"', link: 'https://e.com/a', publishedAt: '2026-10-01T00:00:00Z', isRead: 1, isBookmarked: 0 },
      { title: '=1+1', link: 'https://e.com/b', publishedAt: '', isRead: 0, isBookmarked: 1 },
    ],
    () => 'Src, Inc',
  );
  assert.equal(csv, [
    'Title,Source,Published,URL,Read,Bookmarked',
    '"Say ""hi""","Src, Inc",2026-10-01T00:00:00.000Z,https://e.com/a,yes,no',
    `'=1+1,"Src, Inc",,https://e.com/b,no,yes`,
  ].join('\n'));
});

test('chunkRows groups articles into rows of the column count', () => {
  const ids = (rows) => rows.map((r) => r.map((a) => a.id));
  const articles = [1, 2, 3, 4, 5, 6, 7].map((id) => ({ id }));
  assert.deepEqual(ids(chunkRows(articles, 3)), [[1, 2, 3], [4, 5, 6], [7]]);
  assert.deepEqual(ids(chunkRows(articles.slice(0, 2), 1)), [[1], [2]]);
  assert.deepEqual(chunkRows([], 3), []);
});

test('dayGroup and withDayHeaders group a newest-first list by day', () => {
  const now = new Date(2026, 9, 18, 21, 0); // Sun 18 Oct 2026, 21:00 local
  const at = (d, h = 9) => new Date(2026, 9, d, h).toISOString();
  assert.equal(dayGroup(at(18), now), 'Today');
  assert.equal(dayGroup(at(17, 23), now), 'Yesterday');
  assert.equal(dayGroup(at(13), now), 'Earlier this week');
  assert.equal(dayGroup(at(11), now), 'Older');
  assert.equal(dayGroup('not a date', now), 'Older');
  const items = withDayHeaders([{ id: 1, publishedAt: at(18) }, { id: 2, publishedAt: at(18, 8) }, { id: 3, publishedAt: at(17) }, { id: 4, publishedAt: at(2) }], now);
  assert.deepEqual(items.map((i) => [i.heading, i.article.id]), [['Today', 1], [undefined, 2], ['Yesterday', 3], ['Older', 4]]);
  assert.deepEqual(items.map((i) => i.position), [0, 1, 2, 3], 'positions count articles only');
  assert.equal(new Set(items.map((i) => i.key)).size, items.length, 'keys are unique');
  assert.notEqual(items[0].key, 1, 'a row with a heading is keyed apart from the same row without one');
});

test('shortTime is a clock time today, a weekday this week, a date before', () => {
  const now = new Date(2026, 9, 18, 21, 0);
  assert.match(shortTime(new Date(2026, 9, 18, 19, 12).toISOString(), now), /19.12/);
  assert.notEqual(shortTime(new Date(2026, 9, 16, 9).toISOString(), now), '');
  assert.match(shortTime(new Date(2026, 8, 3).toISOString(), now), /3/);
  assert.match(shortTime(new Date(2025, 8, 3).toISOString(), now), /2025/);
  assert.equal(shortTime('', now), '');
});

test('loaded pages flatten in order, each article once', () => {
  const pages = [{ articles: [{ id: 9 }, { id: 8 }] }, { articles: [{ id: 8 }, { id: 7 }] }];
  assert.deepEqual(flattenPages(pages).map((a) => a.id), [9, 8, 7]);
  assert.deepEqual(flattenPages(), []);
});

test('patching cached pages updates the articles and the unread count', () => {
  const data = {
    pageParams: [0, 2],
    pages: [
      { unread: 3, articles: [{ id: 1, isRead: 0 }, { id: 2, isRead: 1 }] },
      { unread: 3, articles: [{ id: 3, isRead: 0 }, { id: 1, isRead: 0 }] },
    ],
  };
  const patched = patchPages(data, new Set([1, 2, 3]), { isRead: 1 });
  assert.deepEqual(patched.pages.flatMap((p) => p.articles.map((a) => a.isRead)), [1, 1, 1, 1]);
  assert.deepEqual(patched.pages.map((p) => p.unread), [1, 1], 'two newly read, counted once each');
  assert.deepEqual(patched.pageParams, [0, 2]);
  assert.equal(patchPages(patched, new Set([2]), { isRead: 0 }).pages[0].unread, 2);
  assert.equal(patchPages(undefined, new Set([1]), { isRead: 1 }), undefined);
});

test('lists of saves group under save-date headings', () => {
  const now = new Date(2026, 9, 19, 12);
  const at = (day) => new Date(2026, 9, day, 9).toISOString();
  const saves = [{ id: 1, savedAt: at(19), publishedAt: at(1) }, { id: 2, savedAt: at(16), publishedAt: at(18) }];
  assert.equal(groupingFor('saved'), BY_SAVED);
  assert.equal(groupingFor('all'), BY_PUBLISHED);
  const labels = withDayHeaders(saves, now, BY_SAVED).filter((i) => i.heading).map((i) => i.heading);
  assert.deepEqual(labels, ['Saved today', 'Saved this week']);
});

test('collections have their own title, empty state and save-date headings', () => {
  assert.equal(viewTitle({ type: 'collection', name: 'Agent Evals' }), 'Agent Evals');
  assert.equal(viewTitle({ type: 'collection' }), 'Collection');
  assert.equal(emptyStateText({ viewType: 'collection' }).title, 'Nothing in this collection yet');
  assert.equal(groupingFor('collection'), BY_SAVED);
});

test('Unsorted is a list of saves with its own title and empty state', () => {
  assert.equal(isSaveList('unsorted'), true);
  assert.equal(isSaveList('today'), false);
  assert.equal(viewTitle({ type: 'unsorted' }), 'Unsorted saves');
  assert.equal(emptyStateText({ viewType: 'unsorted' }).title, 'All sorted');
});
