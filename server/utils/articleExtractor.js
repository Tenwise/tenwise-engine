import { extractFromHtml } from '@extractus/article-extractor';
import * as cheerio from 'cheerio';
import { fetchText } from './fetchText.js';
import { resolveArticleUrl } from '../plugins.js';

/**
 * Extract the full article content from a URL.
 * Returns cleaned, readable HTML content.
 */
const EXTRACTION_TIMEOUT_MS = 15000;

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Extractor field -> response field, each defaulting to ''.
const TEXT_FIELDS = {
  title: 'title', content: 'content', author: 'author', published: 'publishedAt',
  description: 'description', image: 'image', source: 'source',
};

/** Shapes an extractor result for the client. */
export function toExtracted(article, url) {
  const result = {};
  for (const [from, to] of Object.entries(TEXT_FIELDS)) result[to] = article[from] || '';
  result.url = article.url || url;
  result.ttr = article.ttr || 0; // time to read in seconds
  return result;
}

/** The largest candidate in a srcset ("a.png 640w, b.png 1400w"), or ''. */
export function largestInSrcset(srcset = '') {
  let best = { url: '', size: -1 };
  for (const candidate of srcset.split(/,\s+/)) {
    const [url, descriptor = ''] = candidate.trim().split(/\s+/);
    const size = Number.parseFloat(descriptor) || 0;
    if (url && size > best.size) best = { url, size };
  }
  return best.url;
}

/**
 * Some sites (Medium among them) put an image's URLs only on the <source>
 * tags of its <picture>, leaving the <img> with no src. Readability takes
 * such an <img> for a placeholder and deletes it, and the emptied <picture>
 * goes with it. Giving the <img> its picture's largest source keeps it.
 * Returns how many it filled.
 */
function fillPictureImages($) {
  let filled = 0;
  $('picture img:not([src]):not([srcset])').each((_, el) => {
    const img = $(el);
    const src = largestInSrcset(img.closest('picture').find('source[srcset]').first().attr('srcset'));
    if (src) { img.attr('src', src); filled += 1; }
  });
  return filled;
}

// Page furniture the extractor would otherwise keep as article text. Inside a
// figure, text marked speechify-ignore (not for reading aloud) is a control:
// on Medium, "Press enter or click to view image in full size" over every
// image. From Medium's byline only the read time, date and clap count ("--")
// go. Removing the whole byline, or its author photo, leaves the block above
// the article too light, and Readability drops the article's subtitle with it.
const PAGE_FURNITURE = [
  'figure .speechify-ignore',
  '[data-testid="storyReadTime"]',
  '[data-testid="storyPublishDate"]',
  '.pw-multi-vote-count',
].join(', ');

// Returns how many elements it removed.
function dropPageFurniture($) {
  const found = $(PAGE_FURNITURE);
  found.remove();
  return found.length;
}

/**
 * Prepares a page for extraction: fills in <picture> images and drops page
 * furniture (see above). Pages that need neither come back as they were.
 */
export function prepareForExtraction(html) {
  if (!/<picture|speechify-ignore|data-testid="story|pw-multi-vote-count/i.test(html)) return html;
  const $ = cheerio.load(html);
  const changed = fillPictureImages($) + dropPageFurniture($);
  return changed ? $.html() : html;
}

// Answers and pages of bot checks, which want a browser that runs the site's
// script: statuses sites send them with, and the pages of Cloudflare, AWS WAF,
// SiteGround, DataDome and PerimeterX.
const BLOCKED_STATUSES = new Set([401, 403, 405, 429]);
const BOT_CHECK = /<title>\s*(?:Just a moment|Attention Required|Human Verification)|\/\.well-known\/sgcaptcha\/|captcha-delivery\.com|px-captcha/i;

const siteOf = (url) => URL.parse(url)?.hostname.replace(/^www\./, '') ?? '';

/**
 * A failed extraction, with `reason` for the reader: 'blocked' (the site
 * turns apps away), 'no-article' (the page has none), 'failed' (anything
 * else), or a plugin's own reason (see resolveArticleUrl), and the `site` asked.
 */
function failure(message, reason, site) {
  return Object.assign(new Error(`Article extraction failed: ${message}`), { reason, site });
}

async function fetchArticlePage(target, fetchPage) {
  try {
    return await fetchPage(target, { headers: { 'User-Agent': USER_AGENT }, timeoutMs: EXTRACTION_TIMEOUT_MS });
  } catch (error) {
    throw failure(error.message, BLOCKED_STATUSES.has(error.status) ? 'blocked' : 'failed', siteOf(target));
  }
}

// The URL to fetch: the link itself, unless a plugin rewrites it (a link to
// an aggregator's page, for one) or says why it can't be read.
async function articleUrl(url, fetchPage) {
  try {
    return await resolveArticleUrl(url, fetchPage);
  } catch (error) {
    throw error.reason ? failure(error.message, error.reason, error.site ?? siteOf(url)) : error;
  }
}

// The article on a fetched page, or why there is none: a bot check page
// means the site turned us away, anything else that it has no article.
async function articleOn(page, target) {
  const article = await extractFromHtml(prepareForExtraction(page.text), page.url).catch(() => null);
  if (article) return article;
  if (BOT_CHECK.test(page.text)) throw failure('The site asked for a browser check', 'blocked', siteOf(target));
  throw failure('Could not extract article content', 'no-article', siteOf(target));
}

// The page is fetched by fetchText (SSRF-guarded on every redirect, with our
// User-Agent and a real timeout), then parsed from the HTML string. A plugin
// may first point the link elsewhere (server/plugins.js).
// `fetchPage` is fetchText's signature (tests pass a stub).
export async function extractArticle(url, fetchPage = fetchText) {
  const target = await articleUrl(url, fetchPage);
  const page = await fetchArticlePage(target, fetchPage);
  return toExtracted(await articleOn(page, target), url);
}
