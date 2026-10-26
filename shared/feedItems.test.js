import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeUrl, firstOf, orEmpty, toArticle, withoutTracking } from './feedItems.js';

test('withoutTracking drops only tracking params and otherwise returns the URL untouched', () => {
  assert.equal(withoutTracking('https://www.example.com/a/?utm_source=rss&id=7&fbclid=x#top'), 'https://www.example.com/a/?id=7#top');
  assert.equal(withoutTracking('https://pub.towardsai.net/x?source=rss----98111c9905da---4'), 'https://pub.towardsai.net/x');
  assert.equal(withoutTracking('https://www.ft.com/content/0ed1?syn-25a6b1a6=1'), 'https://www.ft.com/content/0ed1?syn-25a6b1a6=1');
  assert.equal(withoutTracking('https://Example.com/A%20b/'), 'https://Example.com/A%20b/');
  assert.equal(withoutTracking('not a url'), 'not a url');
});

test('firstOf matches a || b || c, including the last-value fallback', () => {
  assert.equal(firstOf('', 'b', 'c'), 'b');
  assert.equal(firstOf(0, null, ''), '');
  assert.equal(firstOf(undefined, undefined), undefined);
  assert.deepEqual(firstOf(null, []), []);
  assert.equal(orEmpty(undefined), '');
  assert.equal(orEmpty('x'), 'x');
});

test('toArticle fills defaults and canonicalizes the link', () => {
  const a = toArticle({ title: 'T', link: 'https://e.com/a?utm_source=x', guid: 'g', publishedAt: '2026-01-01' });
  assert.deepEqual(
    { ...a, canonicalLink: undefined },
    { content: '', summary: '', author: '', imageUrl: '', guid: 'g', canonicalLink: undefined, title: 'T', link: 'https://e.com/a?utm_source=x', publishedAt: '2026-01-01' },
  );
  assert.ok(a.canonicalLink.startsWith('https://e.com/a'));
  const bare = toArticle({ title: 'U', link: 'https://e.com/b' });
  assert.equal(bare.guid, 'https://e.com/b');
  assert.ok(!Number.isNaN(Date.parse(bare.publishedAt)));
});

test('canonicalizeUrl drops tracking, www and a trailing slash, sorts params, keeps the fragment', () => {
  assert.equal(canonicalizeUrl('https://WWW.News.example/story/?utm_source=rss&b=2&a=1'), 'https://news.example/story?a=1&b=2');
  assert.equal(canonicalizeUrl('https://e.com/changelog#v1.3'), 'https://e.com/changelog#v1.3');
  assert.equal(canonicalizeUrl('not a url'), 'not a url');
  assert.equal(canonicalizeUrl(''), '');
});
