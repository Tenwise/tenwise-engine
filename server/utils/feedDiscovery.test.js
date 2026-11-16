import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverFeeds } from './feedDiscovery.js';

// A public literal IP needs no DNS lookup; the stubbed request means nothing
// leaves this machine.
const SITE = 'http://93.184.216.34/';

// A stand-in for the network: answers by method and path, and records each request.
function fakeSite(routes) {
  const calls = [];
  const request = async (url, options) => {
    const { pathname, search } = new URL(url);
    calls.push(`${options.method || 'GET'} ${pathname}${search}`);
    const answer = routes[`${options.method || 'GET'} ${pathname}${search}`];
    if (answer instanceof Error) throw answer;
    return answer ? answer() : new Response('not found', { status: 404 });
  };
  return { request, calls };
}

const html = (body) => () => new Response(`<html><head>${body}</head></html>`, { headers: { 'content-type': 'text/html' } });
const head = (type) => () => new Response(null, { status: 200, headers: { 'content-type': type } });
const rss = (title, newest = 'https://e.example/p/1') => () => new Response(
  `<?xml version="1.0"?><rss version="2.0"><channel><title>${title}</title><link>https://e.example/</link><item><title>One</title><link>${newest}</link></item></channel></rss>`,
  { headers: { 'content-type': 'application/rss+xml' } },
);
const atom = (title, newest = 'https://e.example/p/1') => () => new Response(
  `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${title}</title><entry><title>One</title><link href="${newest}"/><id>${newest}</id></entry></feed>`,
  { headers: { 'content-type': 'application/atom+xml' } },
);

test('feeds a page advertises are returned without probing', async () => {
  const site = fakeSite({
    'GET /': html('<link rel="alternate" type="application/rss+xml" title="Posts" href="/posts.rss">'),
  });
  const feeds = await discoverFeeds(SITE, site.request);
  assert.deepEqual(feeds, [{ url: 'http://93.184.216.34/posts.rss', title: 'Posts', type: 'discovered', urls: ['http://93.184.216.34/posts.rss'] }]);
  assert.deepEqual(site.calls, ['GET /']);
});

test('without advertised feeds, common feed paths that answer like a feed are returned', async () => {
  const site = fakeSite({
    'GET /': html('<title>No feeds here</title>'),
    'HEAD /feed': head('application/rss+xml; charset=utf-8'),
    'GET /feed': rss('Posts'),
    'HEAD /rss': head('text/html'), // a page, not a feed
    'HEAD /atom.xml': head('application/atom+xml'),
    'GET /atom.xml': atom('Notes', 'https://e.example/n/1'),
    'HEAD /index.xml': new Error('connection reset'),
  });
  const feeds = await discoverFeeds(SITE, site.request);
  assert.deepEqual(feeds, [
    { url: 'http://93.184.216.34/feed', title: 'Posts', type: 'probed', urls: ['http://93.184.216.34/feed'] },
    { url: 'http://93.184.216.34/atom.xml', title: 'Notes', type: 'probed', urls: ['http://93.184.216.34/atom.xml'] },
  ]);
  assert.ok(site.calls.includes('HEAD /?feed=rss2'), 'WordPress feeds are tried too');
});

test('a page that cannot be fetched still gets probed', async () => {
  const site = fakeSite({ 'GET /': new Error('timeout'), 'HEAD /rss.xml': head('application/xml'), 'GET /rss.xml': rss('Posts') });
  assert.deepEqual(await discoverFeeds(SITE, site.request), [{ url: 'http://93.184.216.34/rss.xml', title: 'Posts', type: 'probed', urls: ['http://93.184.216.34/rss.xml'] }]);
  const blank = fakeSite({});
  assert.deepEqual(await discoverFeeds(SITE, blank.request), []);
});

test('private addresses and other schemes are refused before any request', async () => {
  const site = fakeSite({});
  await assert.rejects(discoverFeeds('http://127.0.0.1/', site.request), /Blocked private or loopback address/);
  await assert.rejects(discoverFeeds('http://169.254.169.254/', site.request), /Blocked private or loopback address/);
  await assert.rejects(discoverFeeds('file:///etc/passwd', site.request), /Blocked URL scheme/);
  assert.deepEqual(site.calls, []);
});

test('a WordPress site\'s guesses list one titled feed, without its JSON API (PR-23)', async () => {
  // As carbonbrief.org answered on 11 Nov 2026: the page advertises nothing
  // we can read, and six paths answer with the same feed, one as Atom.
  const feed = rss('Carbon Brief');
  const site = fakeSite({
    'GET /': new Error('blocked'),
    'HEAD /feed': head('application/rss+xml'), 'GET /feed': feed,
    'HEAD /feed/': head('application/rss+xml'), 'GET /feed/': feed,
    'HEAD /rss': head('application/rss+xml'), 'GET /rss': feed,
    'HEAD /rss/': head('application/rss+xml'), 'GET /rss/': feed,
    'HEAD /feed/atom': head('application/atom+xml'), 'GET /feed/atom': atom('Carbon Brief'),
    'HEAD /?feed=rss2': head('application/rss+xml'), 'GET /?feed=rss2': feed,
    'HEAD /comments/feed': head('application/rss+xml'),
  });
  const feeds = await discoverFeeds(SITE, site.request);
  assert.deepEqual(feeds.map((f) => [f.url, f.title]), [['http://93.184.216.34/feed', 'Carbon Brief']]);
  assert.equal(feeds[0].urls.length, 6, 'every address of it, to spot one already followed');
  assert.ok(!site.calls.some((c) => c.includes('wp-json')), 'the JSON API is no feed and isn\'t asked');
});

test('a guess that answers like a feed but isn\'t one is dropped', async () => {
  const site = fakeSite({
    'GET /': html('<a href="/feedback">Feedback</a><a href="/rss">RSS</a>'),
    'GET /feedback': () => new Response('<!doctype html><html><body>Tell us</body></html>', { headers: { 'content-type': 'text/html' } }),
    'GET /rss': rss('Posts'),
  });
  assert.deepEqual((await discoverFeeds(SITE, site.request)).map((f) => [f.url, f.title]), [['http://93.184.216.34/rss', 'RSS']]);
});
