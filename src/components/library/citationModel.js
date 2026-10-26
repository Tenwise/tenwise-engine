import { apaCitation, apaReferences } from '../../../shared/citation.js';

// What an APA citation is built from, for each kind of kept article. The
// citation itself is computed on demand (shared/citation.js), never stored.

/** A citation's source from an article (a list row or the full article) and its feed. */
export const articleCitationSource = (article, feed) => ({
  author: article.author,
  publishedAt: article.publishedAt,
  title: article.title,
  link: article.link,
  siteName: feed?.title,
  siteUrl: feed?.siteUrl,
});

/**
 * A citation's source from a saved summary, which keeps its own copy of the
 * article's details. Its feed, found by title, tells an aggregator such as
 * Hacker News apart from the site it links to.
 */
export function summaryCitationSource(row, feeds = []) {
  const feed = row.article_source ? feeds.find((f) => f.title === row.article_source) : undefined;
  return {
    author: row.article_author,
    publishedAt: row.article_published_at,
    title: row.article_title,
    link: row.article_url,
    siteName: row.article_source,
    siteUrl: feed?.siteUrl,
  };
}

/** An article's citation runs ({ text, italic }). */
export const articleCitation = (article, feed) => apaCitation(articleCitationSource(article, feed));

/** Articles as an APA reference list, alphabetical; feedOf(article) is its feed. */
export const articleReferences = (articles, feedOf) => apaReferences(articles.map((a) => articleCitationSource(a, feedOf(a))));
