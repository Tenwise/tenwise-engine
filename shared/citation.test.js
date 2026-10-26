import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  apaCitation, apaReferences, arxivId, citationHtml, citationMarkdown, citationText,
  referencesHtml, referencesMarkdown, referencesText, siteName,
} from './citation.js';

const article = (overrides = {}) => ({
  author: 'Aisha Malik',
  publishedAt: '2026-10-20T15:03:41.000Z',
  title: 'TikTok staff raised child safety concerns',
  link: 'https://techcrunch.com/2026/10/20/tiktok-staff/',
  siteName: 'TechCrunch',
  siteUrl: 'https://techcrunch.com/',
  ...overrides,
});

const text = (source) => citationText(apaCitation(source));
const markdown = (source) => citationMarkdown(apaCitation(source));

test('an article: author, date, title, site in italics, URL', () => {
  assert.deepEqual(apaCitation(article()), [
    { text: 'Malik, A. (2026, October 20). TikTok staff raised child safety concerns. ', italic: false },
    { text: 'TechCrunch', italic: true },
    { text: '. https://techcrunch.com/2026/10/20/tiktok-staff/', italic: false },
  ]);
});

test('several authors are joined the APA way', () => {
  assert.equal(
    markdown(article({ author: 'Paresh Dave, Maxwell Zeff', siteName: 'WIRED', siteUrl: 'https://www.wired.com', link: 'https://www.wired.com/story/x' })),
    'Dave, P., & Zeff, M. (2026, October 20). TikTok staff raised child safety concerns. *WIRED*. https://www.wired.com/story/x',
  );
  assert.match(text(article({ author: 'A Lee, B Kim, C Ng' })), /^Lee, A\., Kim, B\., & Ng, C\. \(2026/);
});

test('no author: the title moves to the front, before the date', () => {
  assert.equal(
    markdown(article({ author: '' })),
    'TikTok staff raised child safety concerns. (2026, October 20). *TechCrunch*. https://techcrunch.com/2026/10/20/tiktok-staff/',
  );
});

test('a title ending in ? or ! takes no extra period', () => {
  assert.equal(
    text(article({ author: '', title: 'Why do we have so many meetings?' })),
    'Why do we have so many meetings? (2026, October 20). TechCrunch. https://techcrunch.com/2026/10/20/tiktok-staff/',
  );
  assert.match(text(article({ title: 'Wow!' })), /\)\. Wow! TechCrunch\./);
});

test('no date, or one that will not parse, is "n.d."', () => {
  for (const publishedAt of [null, undefined, '', 'not a date', 0]) {
    assert.match(text(article({ publishedAt })), /^Malik, A\. \(n\.d\.\)\. TikTok/, String(publishedAt));
  }
});

test('dates are the UTC day the feed gave', () => {
  assert.match(text(article({ publishedAt: '2026-01-02T23:30:00.000Z' })), /\(2026, January 2\)/);
});

test('a group author with the site\'s name is not repeated as the site', () => {
  assert.equal(
    markdown(article({ author: 'Air Street Press', siteName: 'Air Street Press', siteUrl: 'https://press.airstreet.com', link: 'https://press.airstreet.com/p/state' })),
    'Air Street Press. (2026, October 20). TikTok staff raised child safety concerns. https://press.airstreet.com/p/state',
  );
  // A person whose name is the site's keeps both.
  assert.match(markdown(article({ author: 'Martin Fowler', siteName: 'Martin Fowler' })), /^Fowler, M\. .* \*Martin Fowler\*\./);
});

test('an arXiv paper is a preprint: year, italic title, arXiv ID, arXiv as the source', () => {
  const paper = {
    author: 'Faridoun Mehri, Hinrich Sch\\"utze',
    publishedAt: '2026-10-21T04:00:00.000Z',
    title: 'Knowledge That Is Linear Before Fine-Tuning Generalizes After',
    link: 'https://arxiv.org/abs/2610.22300',
    siteName: 'cs.AI updates on arXiv.org',
    siteUrl: 'http://rss.arxiv.org/rss/cs.AI',
  };
  assert.equal(
    markdown(paper),
    'Mehri, F., & Schütze, H. (2026). *Knowledge That Is Linear Before Fine-Tuning Generalizes After* (arXiv:2610.22300). arXiv. https://arxiv.org/abs/2610.22300',
  );
  assert.equal(
    markdown({ ...paper, author: '', link: 'https://arxiv.org/pdf/2610.22300v2', title: 'Is it linear?' }),
    '*Is it linear?* (arXiv:2610.22300). (2026). arXiv. https://arxiv.org/abs/2610.22300',
  );
});

test('arxivId reads new and old IDs from abs, pdf and html links', () => {
  assert.equal(arxivId('https://arxiv.org/abs/2610.11376'), '2610.11376');
  assert.equal(arxivId('https://arxiv.org/pdf/2610.11376v3'), '2610.11376');
  assert.equal(arxivId('https://export.arxiv.org/html/2401.01234v1'), '2401.01234');
  assert.equal(arxivId('http://arxiv.org/abs/hep-th/9901001v1'), 'hep-th/9901001');
  assert.equal(arxivId('https://arxiv.org/abs/math.GT/0309136'), 'math.GT/0309136');
  assert.equal(arxivId('https://example.com/arxiv'), null);
  assert.equal(arxivId(undefined), null);
});

test('siteName drops a feed title\'s tagline, keeping the part that names the host', () => {
  assert.equal(siteName({ siteName: 'Engadget - Technology News & Expert Reviews', link: 'https://www.engadget.com/a' }), 'Engadget');
  assert.equal(siteName({ siteName: 'Aeon | a world of ideas', link: 'https://aeon.co/essays/x' }), 'Aeon');
  assert.equal(siteName({ siteName: 'Artificial intelligence - Crunchbase News', link: 'https://news.crunchbase.com/ai/x' }), 'Crunchbase News');
  assert.equal(siteName({ siteName: 'MIT News - Artificial intelligence', link: 'https://news.mit.edu/2026/x' }), 'MIT News');
  assert.equal(siteName({ siteName: 'Ed Zitron\'s Where\'s Your Ed At', link: 'https://www.wheresyoured.at/x' }), 'Ed Zitron\'s Where\'s Your Ed At');
});

test('siteName names the linked site for aggregators, and the host when there is no title', () => {
  const hn = { siteName: 'Hacker News', siteUrl: 'https://news.ycombinator.com/', link: 'https://www.nber.org/papers/w35706' };
  assert.equal(siteName(hn), 'nber.org');
  assert.equal(siteName({ siteName: 'Lobsters', siteUrl: 'https://lobste.rs/', link: 'https://thezvi.substack.com/p/x' }), 'thezvi.substack.com');
  assert.equal(siteName({ siteName: 'Towards AI - Medium', siteUrl: 'https://pub.towardsai.net?source=rss', link: 'https://pub.towardsai.net/x' }), 'Towards AI');
  assert.equal(siteName({ siteName: 'The Register', siteUrl: 'https://www.theregister.co.uk', link: 'https://go.theregister.co.uk/x' }), 'The Register');
  assert.equal(siteName({ siteName: '', link: 'https://www.example.com/x' }), 'example.com');
  assert.equal(siteName({}), '');
});

test('messy feeds degrade gracefully', () => {
  assert.equal(
    markdown({ author: 'thezvi.substack.com via thisalex', publishedAt: '2026-10-19T07:24:38.000Z', title: 'The Most Forbidden Technique', link: 'https://thezvi.substack.com/p/the-most-forbidden-technique', siteName: 'Lobsters', siteUrl: 'https://lobste.rs/' }),
    'The Most Forbidden Technique. (2026, October 19). *thezvi.substack.com*. https://thezvi.substack.com/p/the-most-forbidden-technique',
  );
  assert.equal(
    text({ author: '[object Object]', title: '  Spaced\n  out ', link: 'https://example.com/a?utm_source=rss&utm_medium=feed&id=7' }),
    'Spaced out. (n.d.). example.com. https://example.com/a?id=7',
  );
  assert.equal(text({}), '[Untitled]. (n.d.).');
  // Stack Overflow's feed hides zero-width characters in titles.
  assert.match(text(article({ title: 'The accidental orchestrator\u200B\u200C \u200D\u200B\uFEFF' })), /\)\. The accidental orchestrator\. TechCrunch/);
});

test('the URL loses tracking parameters and keeps the rest', () => {
  assert.match(text(article({ link: 'https://pub.towardsai.net/what-c32c2b0e039e?source=rss----98111c9905da---4' })), / https:\/\/pub\.towardsai\.net\/what-c32c2b0e039e$/);
  assert.match(text(article({ link: 'https://www.techmeme.com/261021/p6#a261021p6' })), / https:\/\/www\.techmeme\.com\/261021\/p6#a261021p6$/);
});

test('Markdown escapes emphasis marks inside italics; HTML escapes markup', () => {
  const runs = apaCitation(article({ siteName: 'A_B*C', title: 'Fish & <chips>' }));
  assert.match(citationMarkdown(runs), /\*A\\_B\\\*C\*/);
  // A backslash is escaped too, so "\*" in a title can't close the italics early.
  assert.equal(
    markdown(article({ author: '', title: 'Back\\*slash', link: 'https://arxiv.org/abs/2610.00001' })),
    '*Back\\\\\\*slash* (arXiv:2610.00001). (2026). arXiv. https://arxiv.org/abs/2610.00001',
  );
  assert.equal(
    citationHtml(runs),
    'Malik, A. (2026, October 20). Fish &amp; &lt;chips&gt;. <i>A_B*C</i>. https://techcrunch.com/2026/10/20/tiktok-staff/',
  );
});

test('apaReferences sorts a reference list alphabetically, ignoring a leading "The"', () => {
  const list = apaReferences([
    article({ author: 'Zed Young' }),
    article({ author: '', title: 'The middle story' }),
    article({ author: 'Ann Able' }),
  ]);
  assert.deepEqual(list.map((runs) => citationText(runs).slice(0, 10)), ['Able, A. (', 'The middle', 'Young, Z. ']);
  assert.equal(referencesText(list).split('\n\n').length, 3);
  assert.match(referencesMarkdown(list), /\*TechCrunch\*\. https:\S+\n\nThe middle story\./);
  assert.match(referencesHtml(list), /^<p style="margin:0 0 0 0.5in;text-indent:-0.5in">Able, A\./);
});
