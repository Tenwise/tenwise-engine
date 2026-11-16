import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onScreen } from './useOnScreen.js';

const phone = { width: 390, height: 844 };
const menu = { width: 208, height: 240 };

test('a menu that fits stays where it opened', () => {
  assert.deepEqual(onScreen({ x: 40, y: 100 }, menu, phone), { left: 40, top: 100 });
});

test('a menu opened by the right edge moves left to fit, 8 px in', () => {
  // The "…" button on a phone: the menu would end at 494 on a 390 px screen.
  assert.deepEqual(onScreen({ x: 286, y: 400 }, menu, phone), { left: 390 - 208 - 8, top: 400 });
});

test('a menu opened near the bottom moves up to fit', () => {
  assert.deepEqual(onScreen({ x: 40, y: 800 }, menu, phone), { left: 40, top: 844 - 240 - 8 });
});

test('a menu bigger than the screen keeps its top-left corner on it', () => {
  assert.deepEqual(onScreen({ x: 200, y: 300 }, { width: 500, height: 900 }, phone), { left: 8, top: 8 });
});
