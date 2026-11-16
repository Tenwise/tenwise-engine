import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alertOf, cleanWord, hasMutes, muteCondition, parseRules, serializeRules } from './rules.js';

test('cleanWord: whole words and phrases in any language; nothing that needs escaping', () => {
  assert.equal(cleanWord('  Crypto  '), 'crypto');
  assert.equal(cleanWord('Open  AI'), 'open ai');
  assert.equal(cleanWord("don't"), "don't");
  assert.equal(cleanWord('café'), 'café');
  for (const bad of ['', '  ', '*', 'a%b', 'x_y', '[ai]', '?', 'a'.repeat(61), '-lead']) assert.equal(cleanWord(bad), null, bad);
});

test('parseRules: tolerant of anything, deduplicated, capped', () => {
  assert.deepEqual(parseRules(''), { muteWords: [], muteFeeds: [], alertWords: [] });
  assert.deepEqual(parseRules('not json'), { muteWords: [], muteFeeds: [], alertWords: [] });
  const r = parseRules(JSON.stringify({ muteWords: ['Crypto', 'crypto', '%'], muteFeeds: [3, 3, -1, 'x'], alertWords: ['Tenwise'] }));
  assert.deepEqual(r, { muteWords: ['crypto'], muteFeeds: [3], alertWords: ['tenwise'] });
  assert.equal(parseRules({ muteWords: Array.from({ length: 80 }, (_, i) => `w${i}`) }).muteWords.length, 50);
  assert.deepEqual(JSON.parse(serializeRules({ muteWords: ['A'], muteFeeds: [], alertWords: [] })), { muteWords: ['a'], muteFeeds: [], alertWords: [] });
});

test('muteCondition: none without mutes; parameters, never words, in the SQL', () => {
  assert.equal(muteCondition(parseRules({})), null);
  assert.equal(hasMutes(parseRules({ alertWords: ['x'] })), false);
  const c = muteCondition(parseRules({ muteWords: ['crypto'], muteFeeds: [7] }));
  assert.ok(!c.sql.includes('crypto'));
  assert.deepEqual(c.params, ['*[^a-z0-9]crypto[^a-z0-9]*', 7]);
});

test('alertOf: a whole word in the title or excerpt, ignoring case', () => {
  const rules = parseRules({ alertWords: ['ai', 'open source'] });
  assert.equal(alertOf({ title: 'New AI tools' }, rules), 'ai');
  assert.equal(alertOf({ title: 'She said so' }, rules), null, '"ai" inside "said" is not a match');
  assert.equal(alertOf({ title: 'x', excerpt: 'Going open source, finally' }, rules), 'open source');
  assert.equal(alertOf({ title: 'AI' }, parseRules({})), null);
});
