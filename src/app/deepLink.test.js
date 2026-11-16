import { test } from 'node:test';
import assert from 'node:assert/strict';
import { articleIdFrom, withoutArticle, bookmarkletFor, pageToSaveFrom, withoutParam } from './deepLink.js';

test('articleIdFrom: a positive whole id, else null', () => {
  assert.equal(articleIdFrom('?article=42'), 42);
  assert.equal(articleIdFrom('?x=1&article=7'), 7);
  for (const bad of ['', '?article=', '?article=0', '?article=-3', '?article=1.5', '?article=abc', '?other=4']) assert.equal(articleIdFrom(bad), null, bad);
});

test('withoutArticle keeps the rest of the address', () => {
  assert.equal(withoutArticle('https://tenwise.app/?article=42'), '/');
  assert.equal(withoutArticle('https://tenwise.app/?x=1&article=42#top'), '/?x=1#top');
});

test('pageToSaveFrom: a web address to save, or null', () => {
  assert.equal(pageToSaveFrom('?save=https%3A%2F%2Fblog.example%2Fpost%3Fa%3D1'), 'https://blog.example/post?a=1');
  assert.equal(pageToSaveFrom('?save=javascript%3Aalert(1)'), null);
  assert.equal(pageToSaveFrom('?article=3'), null);
  assert.equal(withoutParam('https://tenwise.app/?save=x&view=1#top', 'save'), '/?view=1#top');
});

test('bookmarkletFor opens this Tenwise with the page it is pressed on', () => {
  assert.equal(bookmarkletFor('https://tenwise.app'), "javascript:void(window.open('https://tenwise.app/?save='+encodeURIComponent(location.href)))");
});
