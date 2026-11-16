// Mute and alert rules (PR-5): words and sources the reader never wants to
// see, and words that mark an article worth a look. Kept as one synced
// setting (tenwise-rules, a JSON string). The server applies the mutes in SQL
// (server/db/articlePages.js, reader.js) so a muted article is gone from every
// reading view and count; alerts are marked on list items. Shared by the
// browser (the Settings editor) and the server.
//
// A word matches as a whole word, in the title or the excerpt, ignoring case:
// "ai" matches "AI tools" but not "said". Words are letters (any language),
// digits, spaces, hyphens and apostrophes, so they need no escaping in SQL.

export const RULES_KEY = 'tenwise-rules';
export const LIMITS = { words: 50, wordLength: 60, feeds: 200 };

const WORD = /^[\p{L}\p{N}][\p{L}\p{N} '’-]*$/u;

/** A rule word as stored: trimmed, lower case, single spaces; null when it isn't one. */
export function cleanWord(raw) {
  const word = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ').toLowerCase() : '';
  return word.length > 0 && word.length <= LIMITS.wordLength && WORD.test(word) ? word : null;
}

const words = (list) => [...new Set((Array.isArray(list) ? list : []).map(cleanWord).filter(Boolean))].slice(0, LIMITS.words);
const feedIds = (list) => [...new Set((Array.isArray(list) ? list : []).filter((n) => Number.isInteger(n) && n > 0))].slice(0, LIMITS.feeds);

/** The rules from the setting's string (or an object): { muteWords, muteFeeds, alertWords }, empty when unset or unreadable. */
export function parseRules(raw) {
  let value = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { value = null; }
  }
  return {
    muteWords: words(value?.muteWords),
    muteFeeds: feedIds(value?.muteFeeds),
    alertWords: words(value?.alertWords),
  };
}

/** The setting's string for these rules. */
export const serializeRules = (rules) => JSON.stringify(parseRules(rules));

export const hasMutes = (rules) => rules.muteWords.length > 0 || rules.muteFeeds.length > 0;

// SQLite's GLOB is case-sensitive and has no word boundary, so the text is
// lowered and padded, and the word must sit between two non-word characters.
const BOUNDED = "(' ' || lower(COALESCE(title, '') || ' ' || COALESCE(excerpt, '')) || ' ')";
const globOf = (word) => `*[^a-z0-9]${word}[^a-z0-9]*`;

/** The SQL condition that keeps unmuted articles, with its parameters; null when nothing is muted. */
export function muteCondition(rules) {
  if (!hasMutes(rules)) return null;
  const parts = [];
  const params = [];
  if (rules.muteWords.length) {
    parts.push(`NOT (${rules.muteWords.map(() => `${BOUNDED} GLOB ?`).join(' OR ')})`);
    params.push(...rules.muteWords.map(globOf));
  }
  if (rules.muteFeeds.length) {
    parts.push(`feed_id NOT IN (${rules.muteFeeds.map(() => '?').join(', ')})`);
    params.push(...rules.muteFeeds);
  }
  return { sql: parts.join(' AND '), params };
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The alert word an article's title or excerpt contains, or null. */
export function alertOf(article, rules) {
  if (!rules.alertWords.length) return null;
  const text = ` ${`${article.title ?? ''} ${article.excerpt ?? ''}`.toLowerCase()} `;
  return rules.alertWords.find((w) => new RegExp(`[^a-z0-9]${escapeRegExp(w)}[^a-z0-9]`).test(text)) ?? null;
}
