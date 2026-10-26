import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedIdsFrom } from './refreshInput.js';

test('feedIdsFrom: no ids means every feed; ids must be integers', () => {
  assert.equal(feedIdsFrom({}), null);
  assert.deepEqual(feedIdsFrom({ feedIds: [3, 4] }), [3, 4]);
  assert.deepEqual(feedIdsFrom({ feedIds: [] }), []);
  for (const feedIds of ['3', [3, '4'], [1.5], null]) {
    assert.throws(() => feedIdsFrom({ feedIds }), (err) => err.status === 400);
  }
});
