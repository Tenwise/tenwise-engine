import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterRows, truncate } from './libraryModel.js';

test('filterRows matches any listed field, case-insensitively', () => {
  const rows = [{ id: 1, title: 'Cloud costs', note: null }, { id: 2, title: 'Gardening', note: 'about CLOUDS' }, { id: 3, title: 'Other' }];
  assert.deepEqual(filterRows(rows, 'cloud', ['title', 'note']).map((r) => r.id), [1, 2]);
  assert.equal(filterRows(rows, '  ', ['title']), rows);
});

test('truncate', () => {
  assert.equal(truncate('abcdef', 4), 'abcd…');
  assert.equal(truncate('abc', 4), 'abc');
});
