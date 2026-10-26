import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEXT_COLORS, importResultMessage, textColorsFor } from './settingsModel.js';

test('importResultMessage pluralizes and flags empty imports', () => {
  assert.equal(importResultMessage(1).text, 'Imported 1 feed! Articles are downloading in the background.');
  assert.equal(importResultMessage(3).text, 'Imported 3 feeds! Articles are downloading in the background.');
  assert.deepEqual(importResultMessage(0), { text: 'No new feeds found — all are already added.', type: 'error' });
});

test('textColorsFor shows each preset in the shade of the current theme', () => {
  assert.equal(textColorsFor('dark'), TEXT_COLORS);
  const light = textColorsFor('light');
  assert.deepEqual(light.map((c) => c.id), TEXT_COLORS.map((c) => c.id));
  assert.ok(light.every((c, i) => c.hex === TEXT_COLORS[i].lightHex));
});
