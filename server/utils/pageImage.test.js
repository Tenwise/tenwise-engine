import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPageImage, imageFromHtml } from './pageImage.js';

const page = (meta) => `<!doctype html><html><head><title>t</title>${meta}</head><body><meta property="og:image" content="https://body.example/x.jpg"></body></html>`;

test('imageFromHtml: og:image first, then twitter:image, made absolute (UX-8)', () => {
  assert.equal(imageFromHtml(page('<meta property="og:image" content="https://cdn.example/a.jpg?w=1200&amp;h=630">'), 'https://news.example/post'), 'https://cdn.example/a.jpg?w=1200&h=630');
  assert.equal(imageFromHtml(page('<meta content=\'/img/b.png\' property=\'og:image\'>'), 'https://news.example/post/1'), 'https://news.example/img/b.png');
  assert.equal(imageFromHtml(page('<meta name="twitter:image" content="https://cdn.example/c.jpg">'), 'https://news.example/'), 'https://cdn.example/c.jpg');
  assert.equal(imageFromHtml(page('<meta property="og:image:secure_url" content="https://s.example/d.jpg"><meta property="og:image" content="http://s.example/d.jpg">'), 'https://n.example/'), 'https://s.example/d.jpg');
});

test('imageFromHtml: nothing from the body, no scripts or data: URLs', () => {
  assert.equal(imageFromHtml(page(''), 'https://news.example/'), '', 'a tag after </head> is ignored');
  assert.equal(imageFromHtml(page('<meta property="og:image" content="javascript:alert(1)">'), 'https://n.example/'), '');
  assert.equal(imageFromHtml(page('<meta property="og:image" content="data:image/png;base64,AAAA">'), 'https://n.example/'), '');
  assert.equal(imageFromHtml('not html at all', 'https://n.example/'), '');
});

test('findPageImage fetches the page with limits and reads its final address', async () => {
  const asked = [];
  const fetchPage = async (url, options) => { asked.push({ url, options }); return { text: page('<meta property="og:image" content="pic.jpg">'), url: 'https://moved.example/story/' }; };
  assert.equal(await findPageImage('https://news.example/a', fetchPage), 'https://moved.example/story/pic.jpg');
  assert.equal(asked[0].options.maxBytes, 2 * 1024 * 1024);
  assert.equal(asked[0].options.timeoutMs, 8000);
});
