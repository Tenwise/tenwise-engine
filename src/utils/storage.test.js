import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readStored, readStoredNumber, writeStored } from './storage.js';

const blocked = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('SecurityError'); },
};
const memory = (entries = {}) => {
  const data = new Map(Object.entries(entries));
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), data };
};

test('blocked storage gives the fallback and never throws', () => {
  assert.equal(readStored('theme', 'dark', blocked), 'dark');
  assert.equal(readStoredNumber('width', 600, blocked), 600);
  assert.doesNotThrow(() => writeStored('theme', 'light', blocked));
});

test('readStoredNumber rejects garbage instead of returning NaN', () => {
  const s = memory({ ok: '420', junk: 'wide', empty: '' });
  assert.equal(readStoredNumber('ok', 600, s), 420);
  assert.equal(readStoredNumber('junk', 600, s), 600);
  assert.equal(readStoredNumber('empty', 600, s), 600);
  assert.equal(readStoredNumber('missing', 600, s), 600);
});

test('values round-trip as strings', () => {
  const s = memory();
  writeStored('n', 30, s);
  assert.equal(readStored('n', null, s), '30');
});
