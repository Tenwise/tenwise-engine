// Why the reader shows the feed's text instead of the full article, from the
// { reason, site } the server gave (server/utils/articleExtractor.js).

// Below this many characters the feed sent a summary or an excerpt (Ars
// Technica's run to about 1,000), not the article, so the reason is worth a
// note above it. A feed that carries whole articles gets none.
const SHORT_FEED_TEXT = 2000;

const REASONS = {
  google: () => 'Google News didn’t give the publisher’s link, so this is the feed’s text.',
  blocked: (site) => `${site || 'This site'} doesn’t let apps fetch its articles, so this is the feed’s text.`,
  'no-article': () => 'No article was found at the link, so this is the feed’s text.',
  failed: () => 'The full article couldn’t be fetched, so this is the feed’s text.',
};

/** The sentence that explains a failed extraction, or '' when there was none. */
export function fallbackText(failure) {
  if (!failure) return '';
  return (REASONS[failure.reason] ?? REASONS.failed)(failure.site);
}

/** The note above the article: that sentence, only when the feed sent a short summary. */
export function fallbackNote(failure, feedText = '') {
  const length = feedText.trim().length;
  return length > 0 && length < SHORT_FEED_TEXT ? fallbackText(failure) : '';
}
