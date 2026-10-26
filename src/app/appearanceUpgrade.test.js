import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upgradeAppearanceDefaults } from './appearanceUpgrade.js';

const READER = 'tenwise-reader-settings';

// Runs the upgrade on in-memory storage holding `entries`; returns the stored values.
function upgrade(entries = {}) {
  const data = new Map(Object.entries(entries));
  upgradeAppearanceDefaults({ getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) });
  return data;
}
const reader = (data) => JSON.parse(data.get(READER));

test('old defaults move to the Instrument defaults', () => {
  const data = upgrade({
    'tenwise-font': 'sans',
    'tenwise-color': 'emerald',
    [READER]: JSON.stringify({ fontFamily: 'sans', fontSize: 18 }),
  });
  assert.equal(data.get('tenwise-font'), 'plex');
  assert.equal(data.get('tenwise-color'), 'amber');
  assert.deepEqual(reader(data), { fontFamily: 'newsreader', fontSize: 18 });
});

test('deliberate choices are kept', () => {
  const data = upgrade({
    'tenwise-font': 'merriweather',
    'tenwise-color': 'blue',
    [READER]: JSON.stringify({ fontFamily: 'garamond' }),
  });
  assert.equal(data.get('tenwise-font'), 'merriweather');
  assert.equal(data.get('tenwise-color'), 'blue');
  assert.equal(reader(data).fontFamily, 'garamond');
});

test('runs only once, so a later switch back to Inter sticks', () => {
  const data = upgrade({ 'tenwise-font': 'sans' });
  data.set('tenwise-font', 'sans'); // the user picks Inter again
  const again = upgrade(Object.fromEntries(data));
  assert.equal(again.get('tenwise-font'), 'sans');
});

test('a fresh install has nothing to upgrade', () => {
  const data = upgrade();
  assert.equal(data.get('tenwise-font'), undefined);
  assert.equal(data.get('tenwise-appearance-version'), '3');
});

test('v3 enlarges reader text still at the old 16px default', () => {
  const data = upgrade({ [READER]: JSON.stringify({ fontFamily: 'garamond', fontSize: 16 }) });
  assert.deepEqual(reader(data), { fontFamily: 'garamond', fontSize: 18 });
});

test('from v2, only the v3 step runs, so a chosen Inter stays', () => {
  const data = upgrade({
    'tenwise-appearance-version': '2',
    'tenwise-font': 'sans',
    [READER]: JSON.stringify({ fontFamily: 'sans', fontSize: 20 }),
  });
  assert.equal(data.get('tenwise-font'), 'sans');
  assert.deepEqual(reader(data), { fontFamily: 'sans', fontSize: 20 });
  assert.equal(data.get('tenwise-appearance-version'), '3');
});
