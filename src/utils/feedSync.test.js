import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importNewFeeds, refreshNews, refreshSummary } from './feedSync.js';

test('refreshNews reloads only after a run finishes, and the lists only if it found articles', () => {
  const status = (lastFinishedAt, lastInserted = 0) => ({ lastFinishedAt, lastInserted });
  const nothing = { reloadFeeds: false, reloadArticles: false };
  assert.deepEqual(refreshNews(undefined, status('2026-10-20T10:00:00Z', 5)), nothing, 'first check only notes the run');
  assert.deepEqual(refreshNews('2026-10-20T10:00:00Z', status('2026-10-20T10:00:00Z', 5)), nothing, 'same run as before');
  assert.deepEqual(refreshNews(null, status(null)), nothing, 'no run yet');
  assert.deepEqual(refreshNews('2026-10-20T10:00:00Z', status('2026-10-20T10:15:00Z', 0)), { reloadFeeds: true, reloadArticles: false });
  assert.deepEqual(refreshNews(null, status('2026-10-20T10:15:00Z', 3)), { reloadFeeds: true, reloadArticles: true });
});

test('importNewFeeds skips known and duplicate URLs and returns the saved feeds', async () => {
  const parsed = [
    { title: 'Known', url: 'https://a.example/rss' },
    { title: 'New', url: 'https://b.example/rss' },
    { title: 'New again', url: 'https://b.example/rss' },
    { title: 'Rejected', url: 'https://c.example/rss' },
    { title: 'Other', url: 'https://d.example/rss' },
  ];
  let nextId = 10;
  const store = async (feed) => (feed.title === 'Rejected' ? null : { id: nextId++, url: feed.url });
  const saved = await importNewFeeds(parsed, [{ id: 1, url: 'https://a.example/rss' }], store);
  assert.deepEqual(saved, [{ id: 10, url: 'https://b.example/rss' }, { id: 11, url: 'https://d.example/rss' }]);
});

test('refreshSummary names up to two failed feeds, then counts them', () => {
  assert.deepEqual(refreshSummary({ inserted: 1, failed: [] }), { message: 'Refreshed: 1 new article', type: 'success' });
  assert.equal(refreshSummary({ inserted: 0, failed: ['AI News'] }).message, "Refreshed: 0 new articles. AI News couldn't be refreshed; the sidebar shows why.");
  assert.match(refreshSummary({ inserted: 3, failed: ['A', 'B', 'C'] }).message, /3 feeds couldn't/);
});
