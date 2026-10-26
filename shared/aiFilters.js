// The AI-analysis filters of the article list. Shared by the browser (src/)
// and the server (server/), which applies them when it pages the list.

/** Dimensions of an article's aiAnalysis that the list can filter on. */
export const FILTER_KEYS = ['sentiment', 'urgency', 'frame', 'tone', 'depth'];

export function analysisOf(article) {
  if (!article.aiAnalysis) return null;
  try {
    return JSON.parse(article.aiAnalysis);
  } catch {
    return null; // malformed aiAnalysis — skip
  }
}

/** Values present per filter dimension, e.g. { sentiment: Set{'positive'} }. */
export function availableFilters(articles) {
  const analyses = articles.map(analysisOf).filter(Boolean);
  return Object.fromEntries(FILTER_KEYS.map((key) => [
    key,
    new Set(analyses.map((a) => a[key]).filter(Boolean)),
  ]));
}

/** Applies the AI-only toggle and the active dimension filters. */
export function applyFilters(articles, { activeFilters = {}, aiOnly = false } = {}) {
  const base = aiOnly ? articles.filter((a) => a.aiStatus === 'done') : articles;
  const keys = Object.keys(activeFilters).filter((k) => activeFilters[k]);
  if (keys.length === 0) return base;
  return base.filter((article) => {
    const analysis = analysisOf(article);
    return Boolean(analysis) && keys.every((k) => analysis[k] === activeFilters[k]);
  });
}
