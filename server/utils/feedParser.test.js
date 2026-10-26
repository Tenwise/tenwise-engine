import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeBareAmpersands, extractImageUrl, normalizeFeed, normalizeItem, NOT_A_FEED, parseFeedText } from './feedParser.js';
import { setPlugins } from '../plugins.js';
import { toExtracted } from './articleExtractor.js';

test('extractImageUrl prefers media tags, then image enclosures, then the first <img>', () => {
  const html = '<p>x</p><img class="a" src="https://e.com/body.jpg">';
  assert.equal(extractImageUrl({ mediaContent: { $: { url: 'm.jpg' } }, mediaThumbnail: { $: { url: 't.jpg' } } }), 'm.jpg');
  assert.equal(extractImageUrl({ mediaThumbnail: { $: { url: 't.jpg' } }, content: html }), 't.jpg');
  assert.equal(extractImageUrl({ enclosure: { url: 'e.png', type: 'image/png' }, content: html }), 'e.png');
  assert.equal(extractImageUrl({ enclosure: { url: 'a.mp3', type: 'audio/mpeg' }, content: html }), 'https://e.com/body.jpg');
  assert.equal(extractImageUrl({ contentEncoded: html }), 'https://e.com/body.jpg');
  assert.equal(extractImageUrl({ content: '<p>no image</p>' }), '');
});

test('normalizeItem picks the richest fields and fills defaults', () => {
  assert.deepEqual(normalizeItem({
    title: 'T', link: 'https://e.com/a', contentEncoded: '<p>full</p>', content: 'short',
    contentSnippet: 'snip', dcCreator: 'Ann', creator: 'Bob', isoDate: '2026-01-02T00:00:00.000Z',
    guid: 'g1', categories: ['x'],
  }), {
    title: 'T', link: 'https://e.com/a', content: '<p>full</p>', summary: 'snip', author: 'Ann',
    publishedAt: '2026-01-02T00:00:00.000Z', guid: 'g1', imageUrl: '', categories: ['x'],
  });

  const bare = normalizeItem({ link: 'https://e.com/b', summary: 'sum' });
  assert.equal(bare.title, 'Untitled');
  assert.equal(bare.content, 'sum');
  assert.equal(bare.summary, 'sum');
  assert.equal(bare.author, '');
  assert.equal(bare.guid, 'https://e.com/b');
  assert.deepEqual(bare.categories, []);
  assert.ok(!Number.isNaN(Date.parse(bare.publishedAt)));
});

test('normalizeFeed fills feed defaults', () => {
  const feed = normalizeFeed({ itunes: { image: 'pod.jpg' } }, 'https://e.com/rss');
  assert.deepEqual(feed, {
    title: 'Untitled Feed', description: '', link: 'https://e.com/rss', feedUrl: 'https://e.com/rss',
    language: '', image: 'pod.jpg', items: [],
  });
});

test('a plugin\'s title for a feed wins over the feed\'s own', (t) => {
  t.after(() => setPlugins([]));
  setPlugins([{ feedTitle: (url) => (url.endsWith('/search?q=AI') ? 'AI - Search' : '') }]);
  assert.equal(normalizeFeed({ title: 'Own title' }, 'https://s.example/search?q=AI').title, 'AI - Search');
  assert.equal(normalizeFeed({ title: 'Own title' }, 'https://s.example/other').title, 'Own title');
});

test('toExtracted maps extractor fields with defaults', () => {
  assert.deepEqual(toExtracted({ title: 'T', published: '2026-01-01', ttr: 90 }, 'https://e.com/a'), {
    title: 'T', content: '', author: '', publishedAt: '2026-01-01', description: '', image: '',
    source: '', url: 'https://e.com/a', ttr: 90,
  });
});

test('feedsInHtml finds alternate links, then feed-like anchors, without duplicates', async () => {
  const { feedsInHtml } = await import('./feedDiscovery.js');
  const html = `<head>
    <link rel="alternate" type="application/rss+xml" title="Main" href="/feed.xml">
    <link rel="alternate" type="application/atom+xml" href="https://e.com/atom">
  </head><body>
    <a href="/feed.xml">dup</a>
    <a href="/category/rss"> Category RSS </a>
    <a href="/about">About</a>
  </body>`;
  assert.deepEqual(feedsInHtml(html, new URL('https://e.com/blog/')), [
    { url: 'https://e.com/feed.xml', title: 'Main', type: 'discovered' },
    { url: 'https://e.com/atom', title: '', type: 'discovered' },
    { url: 'https://e.com/category/rss', title: 'Category RSS', type: 'link' },
  ]);
});

test('a bare & is escaped; real entities are left alone', () => {
  assert.equal(escapeBareAmpersands('<t>R&D &amp; Q&A &#38; &#x26; &copy;</t>'), '<t>R&amp;D &amp; Q&amp;A &#38; &#x26; &copy;</t>');
});

test('a feed broken only by a bare & still parses', async () => {
  const xml = '<?xml version="1.0"?><rss version="2.0"><channel><title>AI & ML News</title><link>https://x.example</link>'
    + '<item><title>Q&A with a researcher</title><link>https://x.example/1</link></item></channel></rss>';
  const feed = await parseFeedText(xml);
  assert.equal(feed.title, 'AI & ML News');
  assert.equal(feed.items[0].title, 'Q&A with a researcher');
  await assert.rejects(parseFeedText('<rss><channel><title>unclosed'));
});

test('a web page where the feed should be gets a plain explanation', async () => {
  await assert.rejects(parseFeedText('<!doctype html><html><head><script>a && b</script></head></html>'), { message: NOT_A_FEED });
});
