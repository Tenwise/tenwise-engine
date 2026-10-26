import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemGuid, normalizeDate } from './articleFields.js';

const NOW = '2026-10-18T12:00:00.000Z';

test('normalizeDate turns feed dates into ISO, including named time zones', () => {
  assert.equal(normalizeDate('2026-10-18T10:00:00Z', NOW), '2026-10-18T10:00:00.000Z');
  assert.equal(normalizeDate('Sat, 18 Oct 2026 10:00:00 GMT', NOW), '2026-10-18T10:00:00.000Z');
  assert.equal(normalizeDate('Sat, 18 Oct 2026 10:00:00 IST', NOW), '2026-10-18T04:30:00.000Z');
  assert.equal(normalizeDate('Sat, 18 Oct 2026 10:00:00 PDT', NOW), '2026-10-18T17:00:00.000Z');
});

test('normalizeDate falls back for missing or unreadable dates', () => {
  assert.equal(normalizeDate('', NOW), NOW);
  assert.equal(normalizeDate(null, NOW), NOW);
  assert.equal(normalizeDate('sometime last week', NOW), NOW);
  assert.equal(normalizeDate('Mon, 01 Jan 2001 10:00:00 XYZT', NOW), NOW);
});

test('itemGuid prefers guid, then link, then a stable content hash', () => {
  assert.equal(itemGuid({ guid: 'g1', link: 'https://e.com/a' }), 'g1');
  assert.equal(itemGuid({ guid: '', link: 'https://e.com/a' }), 'https://e.com/a');
  const a = itemGuid({ title: 'One', publishedAt: NOW, summary: 'x' });
  const b = itemGuid({ title: 'Two', publishedAt: NOW, summary: 'x' });
  assert.match(a, /^sha1:[0-9a-f]{40}$/);
  assert.notEqual(a, b);
  assert.equal(a, itemGuid({ title: 'One', publishedAt: NOW, summary: 'x' }));
});
