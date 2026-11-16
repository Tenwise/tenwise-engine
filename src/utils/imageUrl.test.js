import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { setPlugins } from '../plugins/index.js';
import { foreignImageUrl, foreignSrcset, trustedImageHosts } from './imageUrl.js';

afterEach(() => setPlugins(null));

const APP = 'https://tenwise.app';

test('a feed image on another site is kept', () => {
  assert.equal(foreignImageUrl('https://cdn.example/a.jpg', APP), 'https://cdn.example/a.jpg');
  assert.equal(foreignImageUrl(' http://img.example.org/b.png?w=300 ', APP), 'http://img.example.org/b.png?w=300');
  assert.equal(foreignImageUrl('https://notenwise.app/a.jpg', APP), 'https://notenwise.app/a.jpg', 'a look-alike host is just another site');
});

test("a feed image on the app's own site never becomes a request with the session (SEC-022)", () => {
  for (const url of [
    '/api/plan?tz=UTC',
    'api/plan?tz=UTC',
    '//tenwise.app/api/plan?tz=UTC',
    'https://tenwise.app/api/plan?tz=UTC',
    'HTTPS://TENWISE.APP/api/plan?tz=UTC',
    'https://www.tenwise.app/api/plan?tz=UTC',
    'https://sandbox.tenwise.app/b/0123/keep',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    '',
    null,
  ]) assert.equal(foreignImageUrl(url, APP), null, String(url));
  assert.equal(foreignImageUrl('https://tenwise.app/x.png', 'https://sandbox.tenwise.app'), null, 'the parent domain shares the site too');
  assert.equal(foreignImageUrl('http://localhost:3001/api/x', 'http://localhost:3001'), null, 'the local engine as well');
});

test('a srcset is kept only when every candidate is on another site', () => {
  assert.equal(foreignSrcset('https://cdn.example/a.jpg 1x, https://cdn.example/b.jpg 2x', APP), true);
  assert.equal(foreignSrcset('https://cdn.example/a.jpg 1x, /api/plan?tz=UTC 2x', APP), false);
  assert.equal(foreignSrcset('https://tenwise.app/a.jpg 640w', APP), false);
  assert.equal(foreignSrcset('', APP), false);
});

test('a host a plugin trusts (the image proxy) is kept, exactly that host and nothing else on the site', () => {
  const trusted = ['img.tenwise.app'];
  const proxied = 'https://img.tenwise.app/img/abc/def';
  assert.equal(foreignImageUrl(proxied, APP, trusted), proxied);
  assert.equal(foreignImageUrl('https://IMG.tenwise.app/img/abc/def', APP, trusted), 'https://IMG.tenwise.app/img/abc/def');
  for (const url of [
    'https://tenwise.app/api/plan',
    'https://www.tenwise.app/a.png',
    'https://sandbox.tenwise.app/a.png',
    'https://x.img.tenwise.app/a.png',
    'https://img2.tenwise.app/a.png',
    '/img/abc/def',
  ]) assert.equal(foreignImageUrl(url, APP, trusted), null, url);
  assert.equal(foreignImageUrl('https://tenwise.app/x.png', APP, ['tenwise.app']), null, 'never the app\'s own host');
  assert.equal(foreignSrcset(`${proxied} 1x, https://cdn.example/b.jpg 2x`, APP, trusted), true);
  assert.equal(foreignSrcset(`${proxied} 1x, https://www.tenwise.app/b.jpg 2x`, APP, trusted), false);
});

test('the trusted hosts come from the imageHosts slot; none without a plugin', () => {
  assert.deepEqual(trustedImageHosts(APP), []);
  assert.equal(foreignImageUrl('https://img.tenwise.app/img/a/b', APP), null);
  setPlugins([{ imageHosts: [{ id: 'proxy', hosts: (origin) => [`IMG.${new URL(origin).hostname}`] }] }, { imageHosts: [{ id: 'none', hosts: () => null }] }]);
  assert.deepEqual(trustedImageHosts(APP), ['img.tenwise.app']);
  assert.equal(foreignImageUrl('https://img.tenwise.app/img/a/b', APP), 'https://img.tenwise.app/img/a/b');
  assert.equal(foreignImageUrl('https://www.tenwise.app/a.png', APP), null);
});
