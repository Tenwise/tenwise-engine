import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters, availableFilters } from './aiFilters.js';

const analyzed = (id, analysis, extra = {}) => ({ id, aiStatus: 'done', aiAnalysis: JSON.stringify(analysis), ...extra });
const articles = [
  analyzed(1, { sentiment: 'positive', urgency: 'breaking' }),
  analyzed(2, { sentiment: 'negative', urgency: 'breaking' }),
  { id: 3, aiStatus: 'none' },
  { id: 4, aiStatus: 'done', aiAnalysis: '{not json' },
];

test('availableFilters collects values per dimension and skips malformed analyses', () => {
  const f = availableFilters(articles);
  assert.deepEqual([...f.sentiment].sort(), ['negative', 'positive']);
  assert.deepEqual([...f.urgency], ['breaking']);
  assert.equal(f.tone.size, 0);
});

test('applyFilters: AI-only toggle and dimension filters', () => {
  assert.deepEqual(applyFilters(articles).map((a) => a.id), [1, 2, 3, 4]);
  assert.deepEqual(applyFilters(articles, { aiOnly: true }).map((a) => a.id), [1, 2, 4]);
  assert.deepEqual(applyFilters(articles, { activeFilters: { urgency: 'breaking', sentiment: 'negative' } }).map((a) => a.id), [2]);
  assert.deepEqual(applyFilters(articles, { activeFilters: { sentiment: null } }).map((a) => a.id), [1, 2, 3, 4]);
});
