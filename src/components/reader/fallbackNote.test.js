import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fallbackNote, fallbackText } from './fallbackNote.js';

test('fallbackText says why the full article is missing', () => {
  assert.equal(fallbackText({ reason: 'google', site: 'news.google.com' }), 'Google News didn’t give the publisher’s link, so this is the feed’s text.');
  assert.equal(fallbackText({ reason: 'blocked', site: 'arstechnica.com' }), 'arstechnica.com doesn’t let apps fetch its articles, so this is the feed’s text.');
  assert.equal(fallbackText({ reason: 'blocked', site: '' }), 'This site doesn’t let apps fetch its articles, so this is the feed’s text.');
  assert.equal(fallbackText({ reason: 'no-article', site: 'e.com' }), 'No article was found at the link, so this is the feed’s text.');
  assert.equal(fallbackText({ reason: 'failed' }), 'The full article couldn’t be fetched, so this is the feed’s text.');
  // An older server sends no reason.
  assert.equal(fallbackText({}), 'The full article couldn’t be fetched, so this is the feed’s text.');
  assert.equal(fallbackText(null), '');
});

test('fallbackNote shows only over a short feed summary', () => {
  const blocked = { reason: 'blocked', site: 'cphpost.dk' };
  assert.equal(fallbackNote(blocked, 'Spotify removes millions of AI-generated songs  CPH POST'), fallbackText(blocked));
  assert.equal(fallbackNote(blocked, `${'An excerpt. '.repeat(90)}Read full article`), fallbackText(blocked), 'an excerpt of about 1,100 characters');
  assert.equal(fallbackNote(blocked, 'x'.repeat(5000)), '', 'a feed that carries the whole article needs no note');
  assert.equal(fallbackNote(blocked, '   '), '', 'with no feed text the reader shows its own "no text" message');
  assert.equal(fallbackNote(null, 'A short summary'), '', 'no note when extraction worked');
});
