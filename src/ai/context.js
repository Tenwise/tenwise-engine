import { htmlToText } from '../utils/helpers.js';

import { getLimit } from './limits.js';

export function truncate(text, max) {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

// A page extraction much shorter than the feed's own text is the wrong part
// of the page, such as an author box and related links (AI-11).
const EXTRACTION_SHARE = 0.6;
// Feed text shorter than this is a teaser or a stub ("Comments"): any
// extraction beats it.
export const FEED_STUB_CHARS = 800;

/**
 * The page extraction when it's the article, else null so the feed's own text
 * is used (AI-11). The reader shows the same choice, so what people read is
 * what the AI is given.
 */
export function usableExtraction(extractedContent, article) {
  if (!extractedContent) return null;
  const feed = htmlToText(article?.content || article?.summary || '');
  if (feed.length < FEED_STUB_CHARS) return extractedContent;
  return htmlToText(extractedContent).length >= feed.length * EXTRACTION_SHARE ? extractedContent : null;
}

/** Best available plain text: the extracted full text when usable, else RSS content, else summary. */
export function articleText(article, extractedContent) {
  return htmlToText(usableExtraction(extractedContent, article) || article?.content || article?.summary || '');
}

/** Article with title/author/date header, for summaries and chat. */
export function articleContext(article, extractedContent) {
  const published = article?.publishedAt ? new Date(article.publishedAt).toDateString() : 'Unknown';
  return `Title: ${article?.title || 'Unknown'}
Author: ${article?.author || 'Unknown'}
Published: ${published}

${truncate(articleText(article, extractedContent), getLimit('article'))}`;
}
