import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentKey, withCurrentKeys } from './storageKeys.js';

test('keys under the old prefix get the current one; others are left alone', () => {
  assert.equal(currentKey('atlas-pulse-theme'), 'tenwise-theme');
  assert.equal(currentKey('tenwise-theme'), 'tenwise-theme');
  assert.equal(currentKey('feedflow-theme'), 'feedflow-theme');
  assert.deepEqual(withCurrentKeys({ 'atlas-pulse-a': '1', 'tenwise-a': '2', 'atlas-pulse-b': '3', other: '4' }), { 'tenwise-a': '2', 'tenwise-b': '3', other: '4' });
});
