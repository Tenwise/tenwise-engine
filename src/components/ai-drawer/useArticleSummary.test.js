import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSaved } from './useArticleSummary.js';

test('Saved follows the text: a regenerated summary can be saved, the saved one not again (AI-7, AI-14)', () => {
  assert.equal(isSaved([], 'First.'), false);
  assert.equal(isSaved(['First.'], 'First.'), true);
  assert.equal(isSaved(['First.'], 'Second.'), false);
  assert.equal(isSaved(['First.', 'Second.'], 'Second.'), true);
  assert.equal(isSaved(['First.'], ''), false);
});
