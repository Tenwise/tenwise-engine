export { tokenizeQuery } from '../../shared/searchQuery.js';

const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
};

// Plain-text excerpt length stored per article for list views and search.
export const EXCERPT_LENGTH = 300;

/**
 * Removes every `<...>` span in a single linear pass. Once no closing `>`
 * remains, the rest is kept as text — so input like "<<<<…" can't trigger
 * the quadratic backtracking a /<[^>]*>/ regex would.
 */
export function stripTags(html) {
  const s = String(html);
  let out = '';
  let i = 0;
  while (i < s.length) {
    const open = s.indexOf('<', i);
    if (open === -1) break;
    const close = s.indexOf('>', open + 1);
    if (close === -1) break;
    out += s.slice(i, open) + ' ';
    i = close + 1;
  }
  return out + s.slice(i);
}

/** Strips tags, decodes common entities, collapses whitespace. */
export function htmlToText(html) {
  if (!html) return '';
  return stripTags(html)
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m])
    .replace(/\s+/g, ' ')
    .trim();
}

/** Plain-text excerpt from the first non-empty source (RSS summary, then content). */
export function makeExcerpt(...sources) {
  const source = sources.find((s) => s && String(s).trim());
  return htmlToText(source).slice(0, EXCERPT_LENGTH);
}

/** Plain text indexed for full-text search: RSS summary plus content. */
export function searchText(summary, content) {
  return htmlToText([summary, content].filter(Boolean).join(' '));
}
