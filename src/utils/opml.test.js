import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeXML, generateOPML, safeHttpUrl } from './opml.js';

// Regression guard for OPML import: only http(s) URLs may be stored, so a
// crafted OPML file can't slip a javascript:/data: URL into a feed's siteUrl.
test('safeHttpUrl keeps http(s) URLs', () => {
  assert.equal(safeHttpUrl('https://example.com/feed.xml'), 'https://example.com/feed.xml');
  assert.equal(safeHttpUrl('http://news.example.org/rss'), 'http://news.example.org/rss');
});

test('safeHttpUrl drops dangerous or malformed URLs', () => {
  assert.equal(safeHttpUrl('javascript:alert(1)'), '');
  assert.equal(safeHttpUrl('data:text/html,<script>alert(1)</script>'), '');
  assert.equal(safeHttpUrl('file:///etc/passwd'), '');
  assert.equal(safeHttpUrl('not a url'), '');
  assert.equal(safeHttpUrl(''), '');
  assert.equal(safeHttpUrl(null), '');
  assert.equal(safeHttpUrl(undefined), '');
});

test('escapeXML escapes the five XML specials', () => {
  assert.equal(escapeXML(`<a href="x">Tom & Jerry's</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;');
  assert.equal(escapeXML(null), '');
});

test('generateOPML writes folders by id, skips empty ones, then uncategorized feeds', () => {
  const feeds = [
    { title: 'A', url: 'https://a.com/rss', siteUrl: 'https://a.com', folderId: 10 },
    { title: 'B', url: 'https://b.com/rss', siteUrl: '', folderId: 2 },
    { title: 'C', url: 'https://c.com/rss', siteUrl: '', folderId: 99 },
  ];
  const folders = [{ id: 10, name: 'Tech' }, { id: 2, name: 'News' }, { id: 5, name: 'Empty' }];
  const body = generateOPML(feeds, folders).split('<body>\n')[1];
  assert.equal(body, [
    '    <outline text="News" title="News">',
    '      <outline type="rss" text="B" title="B" xmlUrl="https://b.com/rss" htmlUrl="" />',
    '    </outline>',
    '    <outline text="Tech" title="Tech">',
    '      <outline type="rss" text="A" title="A" xmlUrl="https://a.com/rss" htmlUrl="https://a.com" />',
    '    </outline>',
    '    <outline type="rss" text="C" title="C" xmlUrl="https://c.com/rss" htmlUrl="" />',
    '  </body>',
    '</opml>',
  ].join('\n'));
});
