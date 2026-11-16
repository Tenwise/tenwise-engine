import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let reader;
let pages;
before(async () => {
  process.env.TENWISE_DATA_DIR = mkdtempSync(join(tmpdir(), 'tenwise-source-'));
  reader = await import('./reader.js');
  pages = await import('./articlePages.js');
});

const GOOGLE_LINK = 'https://news.google.com/rss/articles/CBMiExample?oc=5';

test('an item\'s publication is stored, and the publisher\'s URL once its link is resolved (BRF-23)', () => {
  const feed = reader.createFeed({ title: '"climate tech" - Google News', url: 'https://news.google.com/rss/search?q=climate' });
  reader.bulkInsertArticles(feed.id, [{ guid: 'g1', title: 'Q3 2026 Climate Tech Report - PitchBook', link: GOOGLE_LINK, sourceTitle: 'PitchBook', content: '', summary: '' }]);
  const [listed] = pages.getArticlePage('feed', feed.id).articles;
  assert.equal(listed.sourceTitle, 'PitchBook', 'the list carries it, for the citation on a row');
  assert.equal(listed.resolvedLink, null);
  assert.equal(reader.setResolvedLink(GOOGLE_LINK, 'https://pitchbook.com/news/reports/q3'), 1);
  assert.equal(reader.getArticleById(listed.id).resolvedLink, 'https://pitchbook.com/news/reports/q3');
  assert.equal(reader.setResolvedLink(GOOGLE_LINK, 'javascript:alert(1)'), 0, 'only http(s)');
  assert.equal(reader.setResolvedLink(GOOGLE_LINK, GOOGLE_LINK), 0);
});
