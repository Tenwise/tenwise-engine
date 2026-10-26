import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuMoveIndex } from './useMenuKeys.js';

test('arrows move one item and wrap around', () => {
  assert.equal(menuMoveIndex('ArrowDown', 0, 3), 1);
  assert.equal(menuMoveIndex('ArrowDown', 2, 3), 0);
  assert.equal(menuMoveIndex('ArrowUp', 1, 3), 0);
  assert.equal(menuMoveIndex('ArrowUp', 0, 3), 2);
});

test('Home and End jump to the first and last item', () => {
  assert.equal(menuMoveIndex('Home', 2, 4), 0);
  assert.equal(menuMoveIndex('End', 0, 4), 3);
});

test('from outside the menu, Down goes to the first item and Up to the last', () => {
  assert.equal(menuMoveIndex('ArrowDown', -1, 3), 0);
  assert.equal(menuMoveIndex('ArrowUp', -1, 3), 2);
});

test('other keys and empty menus do not move focus', () => {
  assert.equal(menuMoveIndex('Enter', 0, 3), undefined);
  assert.equal(menuMoveIndex('ArrowDown', -1, 0), undefined);
});
