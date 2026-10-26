import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { currentKey, LEGACY_KEY_PREFIX } from './storageKeys.js';

// The early script in index.html, run against a fake localStorage and page.
function runEarlyScript(saved) {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const body = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const store = new Map(Object.entries(saved));
  // Like a browser, the order of keys is its own: here, sorted, so a key
  // added while the page walks them can land before ones not yet seen.
  const localStorage = {
    get length() { return store.size; },
    key: (i) => [...store.keys()].sort()[i] ?? null,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const attrs = {};
  const document = { documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => attrs[k], style: { setProperty() {} } } };
  new Function('localStorage', 'document', body)(localStorage, document);
  return { store: Object.fromEntries(store), attrs };
}

test('the page moves keys saved under the old prefix before it applies the theme', () => {
  const { store, attrs } = runEarlyScript({ [`${LEGACY_KEY_PREFIX}theme`]: 'light', [`${LEGACY_KEY_PREFIX}color`]: 'rose', [`${LEGACY_KEY_PREFIX}sidebar-width`]: '300', 'tenwise-color': 'blue', other: 'x' });
  assert.deepEqual(store, { 'tenwise-theme': 'light', 'tenwise-color': 'blue', 'tenwise-sidebar-width': '300', other: 'x' }, 'every old key moved; a current one wins');
  assert.equal(attrs['data-theme'], 'light');
  assert.equal(attrs['data-color'], 'blue');
  assert.equal(currentKey(`${LEGACY_KEY_PREFIX}theme`), 'tenwise-theme', 'the same rule as the server');
});
