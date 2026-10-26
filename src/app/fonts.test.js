import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FONTS, fontById } from './fonts.js';

test('font ids are unique', () => {
  assert.equal(new Set(FONTS.map((f) => f.id)).size, FONTS.length);
});

test('fontById maps the legacy app id and falls back to the default font', () => {
  assert.equal(fontById('serif').id, 'merriweather');
  assert.equal(fontById('source-serif').label, 'Source Serif');
  assert.equal(fontById('nope'), FONTS[0]);
  assert.equal(fontById(undefined), FONTS[0]);
});
