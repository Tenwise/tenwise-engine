import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describe, satisfies, supportedRange } from './check-node.js';

const RANGE = '^22.13.0 || >=24';

test('satisfies accepts versions in the supported range', () => {
  for (const version of ['v22.13.0', 'v22.20.1', 'v24.0.0', 'v24.11.1', 'v26.4.0']) {
    assert.equal(satisfies(version, RANGE), true, version);
  }
});

test('satisfies rejects older majors, early 22.x and the gap before 24', () => {
  for (const version of ['v20.11.1', 'v20.19.0', 'v22.12.0', 'v23.9.0', 'v18.20.4']) {
    assert.equal(satisfies(version, RANGE), false, version);
  }
});

test('satisfies refuses range forms it cannot read', () => {
  assert.throws(() => satisfies('v24.0.0', '>=24 <26'), /can't read/);
  assert.throws(() => satisfies('v24.0.0', '~22.13.0'), /can't read/);
});

test('describe says the range in words', () => {
  assert.equal(describe(RANGE), '22.13+ or 24+');
  assert.equal(describe('>=20.19'), '20.19+');
});

test('the range in package.json is one the check understands', () => {
  const range = supportedRange();
  assert.equal(satisfies('v24.0.0', range), true);
  assert.equal(satisfies('v20.11.1', range), false);
  assert.doesNotMatch(describe(range), /NaN|undefined/);
});
