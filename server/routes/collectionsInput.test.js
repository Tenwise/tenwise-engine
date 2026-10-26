import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArticleIds, parseCollection } from './collectionsInput.js';

test('a new collection needs a name; edits need something to change', () => {
  assert.deepEqual(parseCollection({ name: '  Agent Evals ' }, { required: true }).value, { name: 'Agent Evals', description: undefined });
  assert.equal(parseCollection({}, { required: true }).error, 'name is required');
  assert.equal(parseCollection({ name: '   ' }, { required: true }).error, 'name is required');
  assert.match(parseCollection({ name: 'x'.repeat(81) }, { required: true }).error, /longer than 80/);
  assert.equal(parseCollection({}, { required: false }).error, 'nothing to change');
  assert.deepEqual(parseCollection({ description: ' why ' }, { required: false }).value, { name: undefined, description: 'why' });
  assert.equal(parseCollection({ name: 'n', description: 3 }, { required: true }).error, 'description must be text');
});

test('article ids are positive integers, deduplicated and capped', () => {
  assert.deepEqual(parseArticleIds({ articleIds: [3, 1, 3] }).value, [3, 1]);
  assert.equal(parseArticleIds({}).error, 'articleIds[] is required');
  assert.equal(parseArticleIds({ articleIds: ['1'] }).error, 'articleIds must be positive integers');
  assert.match(parseArticleIds({ articleIds: Array.from({ length: 501 }, (_, i) => i + 1) }).error, /at most 500/);
});
