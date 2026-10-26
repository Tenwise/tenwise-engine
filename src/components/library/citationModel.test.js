import { test } from 'node:test';
import assert from 'node:assert/strict';
import { citationText } from '../../../shared/citation.js';
import { articleCitation, articleCitationSource, articleReferences, summaryCitationSource } from './citationModel.js';

const feed = { id: 3, title: 'Hacker News', siteUrl: 'https://news.ycombinator.com/' };
const row = { id: 9, feedId: 3, author: '', publishedAt: '2026-10-20T15:19:19.000Z', title: 'Why do we have so many meetings?', link: 'https://www.nber.org/papers/w35706', note: 'for the offsite' };

test('an article and its feed give the citation its source', () => {
  assert.deepEqual(articleCitationSource(row, feed), {
    author: '', publishedAt: '2026-10-20T15:19:19.000Z', title: 'Why do we have so many meetings?',
    link: 'https://www.nber.org/papers/w35706', siteName: 'Hacker News', siteUrl: 'https://news.ycombinator.com/',
  });
  assert.equal(
    citationText(articleCitation(row, feed)),
    'Why do we have so many meetings? (2026, October 20). nber.org. https://www.nber.org/papers/w35706',
  );
  assert.equal(articleCitationSource(row, undefined).siteName, undefined);
});

test('a saved summary finds its feed by title, so an aggregator still names the linked site', () => {
  const summary = {
    article_author: 'Ann Lee', article_published_at: '2026-04-25T00:11:43.000Z', article_title: 'Words',
    article_url: 'https://www.ncregister.com/x', article_source: 'Hacker News',
  };
  assert.equal(summaryCitationSource(summary, [feed]).siteUrl, 'https://news.ycombinator.com/');
  assert.equal(summaryCitationSource(summary).siteUrl, undefined);
  assert.equal(summaryCitationSource({ ...summary, article_source: null }, [feed]).siteUrl, undefined);
});

test('articleReferences lists articles alphabetically with their feeds', () => {
  const feeds = { 3: feed, 4: { id: 4, title: 'TechCrunch', siteUrl: 'https://techcrunch.com/' } };
  const list = articleReferences([
    { ...row, feedId: 4, author: 'Zed Young', link: 'https://techcrunch.com/a' },
    row,
  ], (a) => feeds[a.feedId]);
  assert.deepEqual(list.map((runs) => citationText(runs).slice(0, 20)), ['Why do we have so ma', 'Young, Z. (2026, Oct']);
});
