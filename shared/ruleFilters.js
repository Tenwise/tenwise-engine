// Rule filters (PR-13): saved views built from a rule, like Gmail's filters.
// A rule combines words and "quoted phrases" with AND, OR and NOT (capitals),
// and brackets; two terms side by side mean AND. It matches in the title, or
// in the title and the full text. Kept as one synced setting
// (tenwise-rule-filters, a JSON string), shared by the browser (the filter
// editor) and the server, which turns a parsed rule into SQL from fixed
// pieces: each term is a bound parameter, never part of the SQL or of an FTS5
// query's syntax.
import { cleanWord } from './rules.js';

export const RULE_FILTERS_KEY = 'tenwise-rule-filters';
export const RULE_LIMITS = { filters: 50, ruleLength: 300, terms: 20, depth: 8, nameLength: 60 };
export const SCOPES = ['title', 'all'];

// Words, "phrases", brackets; anything else (a lone quote) is an error.
const TOKEN = /\s*(?:"([^"]*)"|(\()|(\))|([^\s()"]+)|(\S))/gy;

const KEYWORDS = new Set(['AND', 'OR', 'NOT']);

// One match of TOKEN as a token.
function tokenOf([, phrase, open, close, word, stray]) {
  if (phrase !== undefined) return { type: 'term', raw: phrase };
  if (open) return { type: '(' };
  if (close) return { type: ')' };
  if (word) return KEYWORDS.has(word) ? { type: word } : { type: 'term', raw: word };
  throw new Error(`Close the quote after ${stray}`);
}

function tokenize(text) {
  const tokens = [];
  TOKEN.lastIndex = 0;
  for (let m = TOKEN.exec(text); m && m[0].length > 0; m = TOKEN.exec(text)) tokens.push(tokenOf(m));
  return tokens;
}

// A recursive-descent parser over the tokens: or → and (OR and)*, and → not
// (AND? not)*, not → NOT not | primary, primary → term | ( or ).
function parser(tokens) {
  let i = 0;
  let terms = 0;
  const peek = () => tokens[i]?.type;
  const startsOperand = () => ['term', '(', 'NOT'].includes(peek());
  function primary(depth) {
    if (depth > RULE_LIMITS.depth) throw new Error('Too many brackets inside each other');
    const token = tokens[i];
    if (!token) throw new Error('The rule ends where a word should be');
    if (token.type === '(') {
      i += 1;
      const inner = or(depth + 1);
      if (peek() !== ')') throw new Error('A bracket isn’t closed');
      i += 1;
      return inner;
    }
    if (token.type !== 'term') throw new Error(`Expected a word before ${token.type}`);
    i += 1;
    const word = cleanWord(token.raw);
    if (!word) throw new Error(`“${token.raw}” isn’t a word: use letters, digits, spaces, - and '`);
    terms += 1;
    if (terms > RULE_LIMITS.terms) throw new Error(`At most ${RULE_LIMITS.terms} words in a rule`);
    return { term: word };
  }
  function not(depth) {
    if (peek() === 'NOT') { i += 1; return { not: not(depth) }; }
    return primary(depth);
  }
  function and(depth) {
    const parts = [not(depth)];
    while (peek() === 'AND' || startsOperand()) {
      if (peek() === 'AND') i += 1;
      parts.push(not(depth));
    }
    return parts.length === 1 ? parts[0] : { and: parts };
  }
  function or(depth) {
    const parts = [and(depth)];
    while (peek() === 'OR') { i += 1; parts.push(and(depth)); }
    return parts.length === 1 ? parts[0] : { or: parts };
  }
  return { parse() {
    const tree = or(0);
    if (i < tokens.length) throw new Error(tokens[i].type === ')' ? 'A bracket closes that wasn’t opened' : 'Something after the rule doesn’t fit');
    return tree;
  } };
}

/** A rule's tree ({ term } | { not } | { and: [] } | { or: [] }), or { error } in plain words. */
export function parseRule(text) {
  const rule = typeof text === 'string' ? text.trim() : '';
  if (!rule) return { error: 'Write a rule, such as: "AI Act" OR GPAI' };
  if (rule.length > RULE_LIMITS.ruleLength) return { error: `A rule is at most ${RULE_LIMITS.ruleLength} characters` };
  try {
    const tokens = tokenize(rule);
    if (tokens.length === 0) return { error: 'Write a rule, such as: "AI Act" OR GPAI' };
    return { tree: parser(tokens).parse() };
  } catch (err) {
    return { error: err.message };
  }
}

const cleanName = (raw) => (typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ').slice(0, RULE_LIMITS.nameLength) : '');

const positiveId = (n) => Number.isSafeInteger(n) && n > 0;
const isFilter = (raw) => positiveId(raw?.id) && Boolean(cleanName(raw?.name)) && !parseRule(raw?.rule).error;

/** One stored filter, checked: { id, name, rule, scope, folderId }, or null when it isn't one. */
export function cleanFilter(raw) {
  if (!isFilter(raw)) return null;
  return {
    id: raw.id,
    name: cleanName(raw.name),
    rule: raw.rule.trim(),
    scope: SCOPES.includes(raw.scope) ? raw.scope : 'title',
    folderId: positiveId(raw.folderId) ? raw.folderId : null,
  };
}

/** The saved filters from the setting's string (or an array): checked, at most 50, [] when unset or unreadable. */
export function parseFilters(raw) {
  let value = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { value = null; }
  }
  const seen = new Set();
  return (Array.isArray(value) ? value : []).map(cleanFilter)
    .filter((f) => f && !seen.has(f.id) && seen.add(f.id))
    .slice(0, RULE_LIMITS.filters);
}

/** The setting's string for these filters. */
export const serializeFilters = (filters) => JSON.stringify(parseFilters(filters));

// A word in the title: lowered and padded, between two non-word characters
// (as the mute rules match). cleanWord leaves only letters, digits, spaces,
// hyphens and apostrophes, so the GLOB pattern needs no escaping.
const TITLE = "(' ' || lower(COALESCE(title, '')) || ' ') GLOB ?";
const titleGlob = (word) => `*[^a-z0-9]${word}[^a-z0-9]*`;
// The full-text index (articles_fts): the term quoted for FTS5, a single
// word also as a prefix, as the search box does.
const BODY = 'id IN (SELECT rowid FROM articles_fts WHERE articles_fts MATCH ?)';
const ftsTerm = (word) => (word.includes(' ') ? `"${word.replace(/"/g, '""')}"` : `"${word.replace(/"/g, '""')}"*`);

/** The SQL condition for a parsed rule, with its parameters, for a scope ('title' or 'all'). */
export function ruleCondition(tree, scope = 'title') {
  if (tree.term !== undefined) {
    if (scope === 'all') return { sql: `(${TITLE} OR ${BODY})`, params: [titleGlob(tree.term), ftsTerm(tree.term)] };
    return { sql: `(${TITLE})`, params: [titleGlob(tree.term)] };
  }
  if (tree.not) {
    const inner = ruleCondition(tree.not, scope);
    return { sql: `(NOT ${inner.sql})`, params: inner.params };
  }
  const parts = (tree.and ?? tree.or).map((t) => ruleCondition(t, scope));
  return { sql: `(${parts.map((p) => p.sql).join(tree.and ? ' AND ' : ' OR ')})`, params: parts.flatMap((p) => p.params) };
}
