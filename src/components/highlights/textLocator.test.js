import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locateAcrossSegments } from './textLocator.js';

const covered = (segments, ranges) => ranges.map((r) => segments[r.segment].slice(r.start, r.end));

test('finds text inside a single segment', () => {
  const segments = ['The quick brown fox'];
  assert.deepEqual(locateAcrossSegments(segments, 'quick brown'), [{ segment: 0, start: 4, end: 15 }]);
});

test('finds text that crosses a link', () => {
  // <p>Read the <a>full report</a> before Friday.</p>
  const segments = ['Read the ', 'full report', ' before Friday.'];
  const ranges = locateAcrossSegments(segments, 'the full report before');
  assert.deepEqual(covered(segments, ranges), ['the', 'full report', 'before']);
});

test('ignores whitespace differences such as line breaks between paragraphs', () => {
  const segments = ['First paragraph ends.', 'Second   starts here.'];
  const ranges = locateAcrossSegments(segments, 'ends.\n\nSecond starts');
  assert.deepEqual(covered(segments, ranges), ['ends.', 'Second   starts']);
});

test('skips segments that hold only whitespace', () => {
  const segments = ['alpha', '\n  ', 'beta'];
  assert.deepEqual(covered(segments, locateAcrossSegments(segments, 'alpha beta')), ['alpha', 'beta']);
});

test('returns the first occurrence, or nothing when absent or blank', () => {
  assert.deepEqual(locateAcrossSegments(['ab ab'], 'ab'), [{ segment: 0, start: 0, end: 2 }]);
  assert.deepEqual(locateAcrossSegments(['abc'], 'xyz'), []);
  assert.deepEqual(locateAcrossSegments(['abc'], '  '), []);
});
