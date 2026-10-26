import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let reader;
let settings;
let refreshFeed;
let refreshFeeds;
let tallyRefreshes;
before(async () => {
  // Point the db layer and settings.json at a throwaway directory before anything opens them.
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-refresh-'));
  reader = await import('../db/reader.js');
  settings = await import('../settings.js');
  ({ refreshFeed, refreshFeeds, tallyRefreshes } = await import('./feedRefresh.js'));
});

// Items as parseFeed returns them (normalizeItem in utils/feedParser.js).
const item = (n, host = 'news.example') => ({
  title: `Story ${n}`, link: `https://${host}/${n}`, guid: `${host}-${n}`,
  content: '', summary: '', author: '', imageUrl: '', categories: [],
  publishedAt: `2026-10-${String(10 + n).padStart(2, '0')}T00:00:00Z`,
});
const parsed = (items, title = 'Fresh title') => async () => ({ title, items });
const failing = (message) => async () => { throw new Error(message); };
const newFeed = (name, folderId = null) => reader.createFeed({ title: name, url: `https://${name}.example/rss`, folderId });
const queued = () => reader.getArticlesByAiStatus(['queued']).map((a) => a.title).sort();
const setBatch = (value) => settings.updateSettings({ 'tenwise-batch-ai': value === null ? null : JSON.stringify(value) });

test('a refresh stores new articles once and takes the feed title from the source', async () => {
  const feed = newFeed('stores');
  const first = await refreshFeed(feed, parsed([item(1, 'stores.example'), item(2, 'stores.example')]));
  assert.equal(first.inserted, 2);
  assert.equal(first.failed, false);
  assert.equal(first.feed.title, 'Fresh title');
  assert.ok(first.feed.lastRefreshed);
  const again = await refreshFeed(feed, parsed([item(1, 'stores.example'), item(2, 'stores.example'), item(3, 'stores.example')]));
  assert.equal(again.inserted, 1, 'only the story it had not seen');
});

test('a failure is remembered on the feed, shortened, and the next success clears it', async () => {
  const feed = newFeed('flaky');
  const failed = await refreshFeed(feed, failing(`Failed to parse feed: Status code 429 ${'x'.repeat(400)}`));
  assert.equal(failed.failed, true);
  assert.equal(failed.inserted, 0);
  assert.equal(failed.feed.lastError.length, 300);
  assert.ok(failed.feed.lastError.startsWith('Failed to parse feed: Status code 429'));
  assert.ok(failed.feed.lastErrorAt);
  const ok = await refreshFeed(feed, parsed([item(1, 'flaky.example')]));
  assert.equal(ok.feed.lastError, null);
  assert.equal(ok.feed.lastErrorAt, null);
});

test('new articles are queued for background AI only when it is on and the feed is in scope', async () => {
  const folder = reader.createFolder({ name: 'AI News' });
  const inside = newFeed('inside', folder.id);
  const outside = newFeed('outside');

  setBatch(null);
  await refreshFeed(inside, parsed([item(1, 'inside.example')]));
  assert.deepEqual(queued(), [], 'off by default');

  setBatch({ enabled: true, scope: `folder:${folder.id}`, maxPerCycle: 2 });
  await refreshFeed(outside, parsed([item(1, 'outside.example')]));
  assert.deepEqual(queued(), [], 'out of scope');
  await refreshFeed(inside, parsed([item(2, 'inside.example'), item(3, 'inside.example'), item(4, 'inside.example')]));
  assert.equal(queued().length, 2, 'the per-cycle limit');
  assert.deepEqual(queued(), ['Story 3', 'Story 4'], 'newest first');
  setBatch(null);
});

test('refreshFeeds refreshes every feed and tallies articles and failures', async () => {
  const feeds = Array.from({ length: 7 }, (_, i) => ({ id: i, title: `Feed ${i}` }));
  const refresh = async (feed) => (feed.id === 3 ? { inserted: 0, failed: true } : { inserted: 1, failed: false });
  assert.deepEqual(await refreshFeeds(feeds, refresh), { inserted: 6, failed: ['Feed 3'] });
  assert.deepEqual(await refreshFeeds([], refresh), { inserted: 0, failed: [] });
});

test('tallyRefreshes adds new articles and names the feeds that failed', () => {
  const chunk = [{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }];
  const tally = tallyRefreshes({ inserted: 1, failed: [] }, [
    { status: 'fulfilled', value: { inserted: 3, failed: false } },
    { status: 'rejected', reason: new Error('x') },
    { status: 'fulfilled', value: { inserted: 0, failed: true } },
    { status: 'fulfilled', value: { inserted: 2, failed: false } },
  ], chunk);
  assert.deepEqual(tally, { inserted: 6, failed: ['B', 'C'] });
});
