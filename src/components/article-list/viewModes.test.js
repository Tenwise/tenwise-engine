import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_VIEW_MODE, VIEW_MODES, viewModeOf } from './viewModes.js';

test('three views, Rows first and the default; Compact is back (UX-12); List and anything unknown become Rows', () => {
  assert.deepEqual(VIEW_MODES.map((m) => m.label), ['Rows', 'Compact', 'Grid']);
  assert.equal(DEFAULT_VIEW_MODE, 'rows');
  assert.equal(viewModeOf('excerpt'), 'rows');
  assert.equal(viewModeOf('list'), 'rows');
  assert.equal(viewModeOf('compact'), 'compact');
  assert.equal(viewModeOf(null), 'rows');
  assert.equal(viewModeOf('magazine'), 'magazine');
});
