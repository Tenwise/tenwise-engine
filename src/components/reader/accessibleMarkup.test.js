import { test } from 'node:test';
import assert from 'node:assert/strict';
import { giveAlt, nameEmptyLink, readableUrl } from './accessibleMarkup.js';

// Just enough of an element for these rules: the test runner has no DOM.
const element = (attributes = {}) => {
  const attrs = new Map(Object.entries(attributes));
  return {
    hasAttribute: (name) => attrs.has(name),
    getAttribute: (name) => attrs.get(name) ?? null,
    setAttribute: (name, value) => attrs.set(name, String(value)),
  };
};

// A link with its text and images, answering the two selectors nameEmptyLink asks.
const link = (href, { text = '', images = [] } = {}) => ({
  ...element({ href }),
  textContent: text,
  querySelectorAll: (selector) => (selector === 'img' ? images : []),
  querySelector: (selector) => ({
    'img[alt]:not([alt=""])': images.find((img) => img.getAttribute('alt')),
    'img, svg, picture, video': images[0],
  })[selector] ?? null,
});

test('an image without alt text is skipped by screen readers (alt="")', () => {
  const img = element({ src: 'https://www.techmeme.com/simg/podcast-thumb.jpg' });
  giveAlt(img);
  assert.equal(img.getAttribute('alt'), '');
});

test('an image without alt text is named by its title, if it has one', () => {
  const titled = element({ src: 'cover.png', title: '  Podcast cover ' });
  const blank = element({ src: 'cover.png', title: '   ' });
  giveAlt(titled);
  giveAlt(blank);
  assert.equal(titled.getAttribute('alt'), 'Podcast cover');
  assert.equal(blank.getAttribute('alt'), '');
});

test('alt text the feed wrote is kept, including an empty one', () => {
  const described = element({ src: 'chart.png', alt: 'Revenue by quarter', title: 'ignored' });
  const decorative = element({ src: 'divider.png', alt: '' });
  giveAlt(described);
  giveAlt(decorative);
  assert.equal(described.getAttribute('alt'), 'Revenue by quarter');
  assert.equal(decorative.getAttribute('alt'), '');
});

test('an image-only link is named by its URL, and its image gets alt=""', () => {
  const img = element({ src: 'thumb.jpg' });
  const a = link('https://example.com/episode/42', { images: [img] });
  nameEmptyLink(a);
  assert.equal(img.getAttribute('alt'), '');
  assert.equal(a.getAttribute('aria-label'), 'Link: example.com/episode/42');
});

test('a link around a titled image is named by the image, not the URL', () => {
  const img = element({ src: 'cover.jpg', title: 'Cover art' });
  const a = link('https://example.com/x', { images: [img] });
  nameEmptyLink(a);
  assert.equal(img.getAttribute('alt'), 'Cover art');
  assert.equal(a.getAttribute('aria-label'), null);
});

test('a link with text keeps its text as its name; an empty one leaves the tab order', () => {
  const withText = link('https://example.com/more', { text: 'Read more', images: [element({ src: 'arrow.png' })] });
  const empty = link('#section');
  nameEmptyLink(withText);
  nameEmptyLink(empty);
  assert.equal(withText.getAttribute('aria-label'), null);
  assert.equal(empty.getAttribute('aria-hidden'), 'true');
  assert.equal(empty.getAttribute('tabindex'), '-1');
});

test('readableUrl names a link by host and path, without the scheme', () => {
  assert.equal(readableUrl('https://www.example.com/'), 'www.example.com');
  assert.equal(readableUrl('https://example.com/2026/10/story?utm=x#top'), 'example.com/2026/10/story');
  assert.equal(readableUrl(`https://example.com/${'a'.repeat(100)}`).length, 80);
  assert.equal(readableUrl('http://[bad'), 'link');
});
