// Article search: AND across terms, each term matching the title, source,
// AI topics, or body. Ranked title › source › topics › body.

import { tokenizeQuery } from './searchQuery.js';

export { tokenizeQuery };

const WEIGHTS = { title: 10, source: 5, topics: 3, body: 1 };

function topicsOf(article) {
  if (!article.aiAnalysis) return '';
  try {
    return (JSON.parse(article.aiAnalysis).topics || []).join(' ').toLowerCase();
  } catch {
    return ''; // malformed aiAnalysis — skip topics
  }
}

/** Fields searched for one article, lowercased. */
export function searchFields(article, sourceTitle) {
  return {
    title: (article.title || '').toLowerCase(),
    source: (sourceTitle || '').toLowerCase(),
    topics: topicsOf(article),
    excerpt: (article.excerpt || '').toLowerCase(),
  };
}

// Score for one term, or 0 if it matches nowhere. bodyIds: Set of article ids
// whose full text contains the term (server full-text index), if available.
function termScore(article, fields, token, bodyIds) {
  const inBody = fields.excerpt.includes(token) || Boolean(bodyIds?.has(article.id));
  const hits = {
    title: fields.title.includes(token),
    source: fields.source.includes(token),
    topics: fields.topics.includes(token),
    body: inBody,
  };
  return Object.keys(hits).reduce((sum, k) => sum + (hits[k] ? WEIGHTS[k] : 0), 0);
}

/**
 * Filters and ranks articles. bodyMatches: Map<term, Set<id>> from the
 * full-text index; terms missing from it fall back to the excerpt.
 */
export function rankArticles(articles, tokens, { sourceOf = () => '', bodyMatches = new Map() } = {}) {
  if (tokens.length === 0) return articles;
  const scored = [];
  for (const article of articles) {
    const fields = searchFields(article, sourceOf(article));
    let score = 0;
    const allMatch = tokens.every((token) => {
      const s = termScore(article, fields, token, bodyMatches.get(token));
      score += s;
      return s > 0;
    });
    if (allMatch) scored.push({ article, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.article);
}
