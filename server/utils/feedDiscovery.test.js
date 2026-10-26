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

test('feeds a page advertises are returned without probing', async () => {
  const site = fakeSite({
    'GET /': html('<link rel="alternate" type="application/rss+xml" title="Posts" href="/posts.rss">'),
  });
  const feeds = await discoverFeeds(SITE, site.request);
  assert.deepEqual(feeds, [{ url: 'http://93.184.216.34/posts.rss', title: 'Posts', type: 'discovered' }]);
  assert.deepEqual(site.calls, ['GET /']);
});

test('without advertised feeds, common feed paths that answer like a feed are returned', async () => {
  const site = fakeSite({
    'GET /': html('<title>No feeds here</title>'),
    'HEAD /feed': head('application/rss+xml; charset=utf-8'),
    'HEAD /rss': head('text/html'), // a page, not a feed
    'HEAD /atom.xml': head('application/atom+xml'),
    'HEAD /index.xml': new Error('connection reset'),
  });
  const feeds = await discoverFeeds(SITE, site.request);
  assert.deepEqual(feeds, [
    { url: 'http://93.184.216.34/feed', title: '', type: 'probed' },
    { url: 'http://93.184.216.34/atom.xml', title: '', type: 'probed' },
  ]);
  assert.ok(site.calls.includes('HEAD /?feed=rss2'), 'WordPress feeds are tried too');
});

test('a page that cannot be fetched still gets probed', async () => {
  const site = fakeSite({ 'GET /': new Error('timeout'), 'HEAD /rss.xml': head('application/xml') });
  assert.deepEqual(await discoverFeeds(SITE, site.request), [{ url: 'http://93.184.216.34/rss.xml', title: '', type: 'probed' }]);
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
