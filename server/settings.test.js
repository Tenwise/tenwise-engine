import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readSettings, updateSettings } from './settings.js';

const tempFile = () => join(mkdtempSync(join(tmpdir(), 'tenwise-settings-')), 'settings.json');

test('a missing or broken file reads as no settings', () => {
  const path = tempFile();
  assert.deepEqual(readSettings(path), {});
  writeFileSync(path, '{ not json');
  assert.deepEqual(readSettings(path), {});
});

test('changes merge, null removes, and the file is readable JSON', () => {
  const path = tempFile();
  updateSettings({ 'tenwise-theme': 'dark', 'tenwise-font': 'plex' }, path);
  const values = updateSettings({ 'tenwise-theme': 'light', 'tenwise-font': null }, path);
  assert.deepEqual(values, { 'tenwise-theme': 'light' });
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), { 'tenwise-theme': 'light' });
});

test('unknown keys, non-strings and oversized values are rejected', () => {
  const path = tempFile();
  assert.throws(() => updateSettings({ 'tenwise-sidebar-width': '300' }, path), /Unknown setting/);
  assert.throws(() => updateSettings({ 'tenwise-theme': 3 }, path), /must be a string/);
  assert.throws(() => updateSettings({ 'tenwise-prompts': 'x'.repeat(70000) }, path), /too long/);
  assert.throws(() => updateSettings(['tenwise-theme'], path), /must be an object/);
  assert.deepEqual(readSettings(path), {});
});

test('settings saved under the old key names are carried over, and the new name wins', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'tenwise-settings-')), 'settings.json');
  writeFileSync(path, JSON.stringify({ 'atlas-pulse-theme': 'light', 'atlas-pulse-font': 'inter', 'tenwise-font': 'lato' }));
  assert.deepEqual(readSettings(path), { 'tenwise-theme': 'light', 'tenwise-font': 'lato' });

  updateSettings({ 'atlas-pulse-color': 'rose' }, path); // from a page loaded before the rename
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), { 'tenwise-theme': 'light', 'tenwise-font': 'lato', 'tenwise-color': 'rose' }, 'the file is rewritten under the new names only');
});
