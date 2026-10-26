import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScrollPosition, saveScrollPosition } from './scrollMemory.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), data };
}

test('scroll positions round-trip, and the top of an article is forgotten', () => {
  const storage = memoryStorage();
  saveScrollPosition(12, 840.6, storage);
  assert.equal(loadScrollPosition(12, storage), 841);
  saveScrollPosition(12, 0, storage);
  assert.equal(loadScrollPosition(12, storage), 0);
  assert.equal(loadScrollPosition(99, storage), 0);
});

test('only the most recent 300 positions are kept', () => {
  const storage = memoryStorage();
  // Integer ids, saved newest-last in descending order, so recency and numeric order disagree.
  for (let id = 1000; id > 695; id--) saveScrollPosition(id, 100, storage);
  saveScrollPosition(999, 200, storage); // saving again makes an old entry recent
  assert.equal(loadScrollPosition(1000, storage), 0, 'oldest dropped');
  assert.equal(loadScrollPosition(998, storage), 0, 'second oldest dropped');
  assert.equal(loadScrollPosition(999, storage), 200);
  assert.equal(loadScrollPosition(696, storage), 100, 'newest kept');
  assert.equal(JSON.parse(storage.data.get('tenwise-scroll-positions')).length, 300);
});

test('corrupt or blocked storage is treated as empty', () => {
  const corrupt = { getItem: () => '{not json', setItem: () => { throw new Error('blocked'); } };
  assert.equal(loadScrollPosition(1, corrupt), 0);
  assert.doesNotThrow(() => saveScrollPosition(1, 50, corrupt));
});
