import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batchSlots, DEFAULT_BATCH_SETTINGS, parseBatchSettings, parseScope, scopeIncludes } from './batchScope.js';

test('parseScope reads all, feed, and folder scopes', () => {
  assert.deepEqual(parseScope('all'), { type: 'all', id: null });
  assert.deepEqual(parseScope(undefined), { type: 'all', id: null });
  assert.deepEqual(parseScope('feed:12'), { type: 'feed', id: 12 });
  assert.deepEqual(parseScope('folder:3'), { type: 'folder', id: 3 });
});

test('parseBatchSettings fills defaults and survives a missing or broken value', () => {
  assert.deepEqual(parseBatchSettings(null), DEFAULT_BATCH_SETTINGS);
  assert.deepEqual(parseBatchSettings('{not json'), DEFAULT_BATCH_SETTINGS);
  assert.deepEqual(parseBatchSettings('{"enabled":true,"maxPerCycle":5}'), { ...DEFAULT_BATCH_SETTINGS, enabled: true, maxPerCycle: 5 });
  assert.notEqual(parseBatchSettings(null), DEFAULT_BATCH_SETTINGS, 'a copy, so callers cannot change the defaults');
});

test('scopeIncludes matches all, one feed, or one folder; unknown types never', () => {
  const feed = { id: 4, folderId: 2 };
  assert.equal(scopeIncludes('all', feed), true);
  assert.equal(scopeIncludes(undefined, feed), true);
  assert.equal(scopeIncludes('feed:4', feed), true);
  assert.equal(scopeIncludes('feed:5', feed), false);
  assert.equal(scopeIncludes('folder:2', feed), true);
  assert.equal(scopeIncludes('folder:3', feed), false);
  assert.equal(scopeIncludes('folder:2', { id: 4, folderId: null }), false);
  assert.equal(scopeIncludes('bogus:1', feed), false);
  assert.equal(scopeIncludes('constructor:1', feed), false);
});

test('batchSlots leaves room up to the per-cycle limit, and none when off or out of scope', () => {
  const feed = { id: 4, folderId: 2 };
  const on = { ...DEFAULT_BATCH_SETTINGS, enabled: true, maxPerCycle: 20 };
  assert.equal(batchSlots(on, feed, 5), 15);
  assert.equal(batchSlots(on, feed, 25), 0);
  assert.equal(batchSlots({ ...on, enabled: false }, feed, 0), 0);
  assert.equal(batchSlots({ ...on, scope: 'folder:9' }, feed, 0), 0);
});
