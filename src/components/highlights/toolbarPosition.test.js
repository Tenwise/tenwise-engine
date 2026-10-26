import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolbarPosition } from './toolbarPosition.js';

const container = { left: 100, right: 900, top: 50 };

test('centres above the selection when there is room', () => {
  assert.deepEqual(toolbarPosition({ left: 400, width: 100, top: 300, bottom: 320 }, container), { left: 345, top: 252 });
});

test('clamps horizontally inside the panel', () => {
  assert.equal(toolbarPosition({ left: 90, width: 10, top: 300, bottom: 320 }, container).left, 108);
  assert.equal(toolbarPosition({ left: 880, width: 10, top: 300, bottom: 320 }, container).left, 682);
});

test('falls below the selection near the panel top', () => {
  assert.equal(toolbarPosition({ left: 400, width: 100, top: 80, bottom: 100 }, container).top, 108);
});
