import { htmlToText } from '../utils/helpers.js';

import { getLimit } from './limits.js';

export function truncate(text, max) {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

/** Best available plain text: extracted full text, else RSS content, else summary. */
export function articleText(article, extractedContent) {
  return htmlToText(extractedContent || article?.content || article?.summary || '');
}

/** Article with title/author/date header, for summaries and chat. */
export function articleContext(article, extractedContent) {
  const published = article?.publishedAt ? new Date(article.publishedAt).toDateString() : 'Unknown';
  return `Title: ${article?.title || 'Unknown'}
Author: ${article?.author || 'Unknown'}
Published: ${published}

${truncate(articleText(article, extractedContent), getLimit('article'))}`;
}
