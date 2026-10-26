import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText, stripHtml } from './helpers.js';

const longHtml = `<p>${'word '.repeat(400)}</p><p>The final sentence matters.</p>`;

test('htmlToText returns the full text, untruncated', () => {
  const text = htmlToText(longHtml);
  assert.ok(text.length > 2000);
  assert.ok(text.endsWith('The final sentence matters.'));
});

test('htmlToText strips tags and collapses whitespace', () => {
  assert.equal(htmlToText('<h1>Title</h1>\n\n<p>Body   text</p>'), 'Title Body text');
  assert.equal(htmlToText(''), '');
  assert.equal(htmlToText(null), '');
});

test('stripHtml still returns a short snippet for previews', () => {
  const snippet = stripHtml(longHtml);
  assert.ok(snippet.length <= 163, `length ${snippet.length}`); // ≤160 chars + '...'
  assert.ok(snippet.endsWith('...'));
});
