import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accentVars, adjustHexBrightness, hexToRgba, parseColorChoice } from './appearance.js';

test('hexToRgba and adjustHexBrightness (clamped)', () => {
  assert.equal(hexToRgba('#00d4aa', 0.15), 'rgba(0, 212, 170, 0.15)');
  assert.equal(adjustHexBrightness('#00d4aa', 20), '#14e8be');
  assert.equal(adjustHexBrightness('#fafafa', 20), '#ffffff');
  assert.equal(adjustHexBrightness('#050505', -20), '#000000');
});

test('accentVars derives all accent properties', () => {
  assert.deepEqual(accentVars('#3b82f6'), {
    '--accent': '#3b82f6',
    '--accent-hover': '#4f96ff',
    '--accent-muted': 'rgba(59, 130, 246, 0.15)',
    '--accent-border': 'rgba(59, 130, 246, 0.3)',
    '--shadow-glow': '0 0 20px rgba(59, 130, 246, 0.1)',
  });
});

test('parseColorChoice distinguishes presets from custom hex', () => {
  assert.deepEqual(parseColorChoice('emerald'), { preset: 'emerald', hex: null });
  assert.deepEqual(parseColorChoice('#123456'), { preset: 'custom', hex: '#123456' });
});
