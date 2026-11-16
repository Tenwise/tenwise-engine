// An article's picture when its feed gave none (UX-8): the page's own
// og:image or twitter:image, the one sites set for link previews. Fetched by
// fetchText (SSRF-guarded on every redirect), at most 2 MB, 8 seconds; only
// the <head>'s meta tags are read, and only an http(s) address is kept.
import { fetchText } from './fetchText.js';
import { USER_AGENT } from './articleExtractor.js';

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const NAMES = ['og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'];

// Each <meta …> tag's attributes, lower-cased names: [{ property, name, content }].
function metaTags(head) {
  return [...head.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => Object.fromEntries(
    [...tag.matchAll(/([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(([, k, d, s]) => [k.toLowerCase(), d ?? s]),
  ));
}

const decodeEntities = (s) => s.replace(/&amp;/g, '&').replace(/&#38;/g, '&').replace(/&quot;/g, '"');

/** The page's preview image as an absolute http(s) URL, or '' when it has none. */
export function imageFromHtml(html, pageUrl) {
  const head = String(html).slice(0, 300_000).split(/<\/head>/i)[0];
  const tags = metaTags(head);
  for (const name of NAMES) {
    const tag = tags.find((t) => (t.property ?? t.name)?.toLowerCase() === name && t.content);
    if (!tag) continue;
    try {
      const url = new URL(decodeEntities(tag.content.trim()), pageUrl);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
    } catch { /* not a URL: try the next */ }
  }
  return '';
}

/** Fetches the article's page and finds its preview image; '' when none. fetchPage: fetchText's signature (tests pass a stub). */
export async function findPageImage(url, fetchPage = fetchText) {
  const { text, url: finalUrl } = await fetchPage(url, { headers: { 'User-Agent': USER_AGENT }, timeoutMs: TIMEOUT_MS, maxBytes: MAX_BYTES });
  return imageFromHtml(text, finalUrl);
}
