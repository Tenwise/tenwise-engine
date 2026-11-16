import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanFilter, parseFilters, parseRule, ruleCondition, RULE_LIMITS } from './ruleFilters.js';

test('parseRule: words, phrases, AND, OR, NOT and brackets; side by side is AND', () => {
  assert.deepEqual(parseRule('("AI Act" OR GPAI) AND NOT opinion').tree, {
    and: [{ or: [{ term: 'ai act' }, { term: 'gpai' }] }, { not: { term: 'opinion' } }],
  });
  assert.deepEqual(parseRule('cloud kubernetes').tree, { and: [{ term: 'cloud' }, { term: 'kubernetes' }] });
  assert.deepEqual(parseRule('a OR b c').tree, { or: [{ term: 'a' }, { and: [{ term: 'b' }, { term: 'c' }] }] }, 'AND binds tighter than OR');
  assert.deepEqual(parseRule('climate or tech').tree, { and: [{ term: 'climate' }, { term: 'or' }, { term: 'tech' }] }, 'lower-case or is a word');
});

test('parseRule: plain errors, and limits', () => {
  for (const bad of ['', '(a OR b', 'a OR', 'a)', 'OR a', '"unclosed', 'a; DROP TABLE articles', 'x*', `${'a '.repeat(RULE_LIMITS.terms + 1)}`, 'x'.repeat(RULE_LIMITS.ruleLength + 1)]) {
    assert.ok(parseRule(bad).error, `${bad.slice(0, 30)} is refused`);
  }
  assert.ok(parseRule(`${'('.repeat(RULE_LIMITS.depth + 2)}a${')'.repeat(RULE_LIMITS.depth + 2)}`).error, 'too deep');
});

test('ruleCondition: fixed SQL, every word a parameter (title, or title and full text)', () => {
  const { tree } = parseRule('"AI Act" OR NOT gpai');
  const title = ruleCondition(tree, 'title');
  assert.equal(title.sql, "(((' ' || lower(COALESCE(title, '')) || ' ') GLOB ?) OR (NOT ((' ' || lower(COALESCE(title, '')) || ' ') GLOB ?)))");
  assert.deepEqual(title.params, ['*[^a-z0-9]ai act[^a-z0-9]*', '*[^a-z0-9]gpai[^a-z0-9]*']);
  const all = ruleCondition(parseRule('cloud').tree, 'all');
  assert.match(all.sql, /articles_fts MATCH \?/);
  assert.deepEqual(all.params, ['*[^a-z0-9]cloud[^a-z0-9]*', '"cloud"*']);
  assert.ok(!/ai act|gpai|cloud/.test(title.sql + all.sql), 'no word is in the SQL');
});

test('parseFilters keeps checked filters only', () => {
  const good = { id: 1, name: '  EU AI  ', rule: '"AI Act"', scope: 'all', folderId: 3 };
  assert.deepEqual(cleanFilter(good), { id: 1, name: 'EU AI', rule: '"AI Act"', scope: 'all', folderId: 3 });
  assert.equal(cleanFilter({ ...good, rule: '(' }), null);
  assert.equal(cleanFilter({ ...good, id: 'x' }), null);
  assert.equal(cleanFilter({ ...good, scope: 'sql' }).scope, 'title');
  assert.deepEqual(parseFilters(JSON.stringify([good, good, { nope: 1 }])).map((f) => f.id), [1]);
  assert.deepEqual(parseFilters('not json'), []);
});
