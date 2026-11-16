import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPlugins } from '../../plugins/index.js';
import { defaultSettingsMode, offered } from './modes.js';

test('Settings opens in Power, with every setting, unless a plugin says otherwise', () => {
  setPlugins(null);
  assert.equal(defaultSettingsMode(), 'power');
  assert.equal(offered({ id: 'settings-file', capability: 'settingsFile' }), true);
  assert.equal(offered({ id: 'theme' }), true);
});

test('hosted: Settings opens in Simple, and the settings file is left out', () => {
  setPlugins([{ capabilities: [{ settingsPowerFirst: false, settingsFile: false }] }]);
  assert.equal(defaultSettingsMode(), 'simple');
  assert.equal(offered({ id: 'settings-file', capability: 'settingsFile' }), false);
  assert.equal(offered({ id: 'theme' }), true);
  setPlugins(null);
});
