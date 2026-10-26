import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripTags, htmlToText, makeExcerpt } from './text.js';

test('stripTags removes tags, including nested fragments', () => {
  assert.equal(htmlToText('<p>Hello <b>world</b></p>'), 'Hello world');
  assert.equal(htmlToText('<scr<b>ipt>alert(1)'), 'ipt>alert(1)');
});

test('stripTags keeps unterminated "<" as text', () => {
  assert.equal(stripTags('a < b and c'), 'a < b and c');
});

test('stripTags is linear on adversarial input', () => {
  const evil = '<'.repeat(200000);
  const start = process.hrtime.bigint();
  assert.equal(stripTags(evil), evil);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(ms < 200, `took ${ms.toFixed(1)} ms`);
});

test('htmlToText decodes common entities; makeExcerpt prefers the first non-empty source', () => {
  assert.equal(htmlToText('Fish &amp; chips&nbsp;&lt;3'), 'Fish & chips <3');
  assert.equal(makeExcerpt('', '<p>From content</p>'), 'From content');
});
