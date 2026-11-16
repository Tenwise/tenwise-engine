import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { capability, setPlugins } from './index.js';

afterEach(() => setPlugins(null));

test('a plain build has every capability', () => {
  assert.equal(capability('seedSettingsFromBrowser'), true);
});

test('a plugin turns a capability off; others stay on', () => {
  setPlugins([{ capabilities: [{ seedSettingsFromBrowser: false }] }, { capabilities: [{ seedSettingsFromBrowser: true }] }]);
  assert.equal(capability('seedSettingsFromBrowser'), false);
  assert.equal(capability('somethingElse'), true);
});
