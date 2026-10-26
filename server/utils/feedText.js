import RSSParser from 'rss-parser';

// Parses text only: feeds are fetched by fetchText, so redirects are checked
// by the SSRF guard (rss-parser's own parseURL follows them unchecked).
const parser = new RSSParser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'dcCreator'],
    ],
  },
});

export const NOT_A_FEED = 'The address returned a web page, not a feed. The site may have moved or dropped its feed.';

// A bare "&" (not starting an entity like &amp; or &#38;) is the most common
// way real feeds break XML; browsers shrug it off, the XML parser doesn't.
const BARE_AMPERSAND = /&(?![a-zA-Z][a-zA-Z0-9]*;|#[0-9]+;|#x[0-9a-fA-F]+;)/g;
const HTML_PAGE = /^\s*(<!doctype html|<html)/i;

/** Escapes bare ampersands so slightly malformed feeds still parse. */
export const escapeBareAmpersands = (xml) => xml.replace(BARE_AMPERSAND, '&amp;');

const parseError = (error) => new Error(`Failed to parse feed: ${error.message}`, { cause: error });

// The strict parse failed: one more try with bare "&"s escaped, else the original error.
async function parseRepaired(text, strictError) {
  const repaired = escapeBareAmpersands(text);
  if (repaired === text) throw parseError(strictError);
  return parser.parseString(repaired).catch(() => { throw parseError(strictError); });
}

/**
 * Parses feed XML strictly first; if that fails, once more with bare "&"s
 * escaped. A web page where the feed should be gets a plain explanation.
 */
export async function parseFeedText(text) {
  if (HTML_PAGE.test(text)) throw new Error(NOT_A_FEED);
  return parser.parseString(text).catch((strictError) => parseRepaired(text, strictError));
}
