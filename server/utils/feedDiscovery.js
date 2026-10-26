import * as cheerio from 'cheerio';
import { assertPublicHttpUrl, guardedRequest, safeFetch } from './urlGuard.js';

const COMMON_FEED_PATHS = [
  '/feed',
  '/feed/',
  '/rss',
  '/rss/',
  '/atom.xml',
  '/feed.xml',
  '/rss.xml',
  '/index.xml',
  '/feeds/posts/default',       // Blogger
  '/feed/atom',
  '/?feed=rss2',                // WordPress
  '/wp-json/wp/v2/posts?_fields=link',
];

const FEED_LINK_SELECTOR = 'link[type="application/rss+xml"], link[type="application/atom+xml"], link[type="application/feed+json"]';
const FEED_ANCHOR_SELECTOR = 'a[href*="rss"], a[href*="feed"], a[href*="atom"]';
const FEED_HREF_HINTS = ['/rss', '/feed', '/atom', '.xml'];
const FEED_CONTENT_TYPES = ['xml', 'rss', 'atom', 'json'];

const looksLikeFeedHref = (href) => FEED_HREF_HINTS.some((hint) => href.includes(hint));
const isFeedContentType = (type) => FEED_CONTENT_TYPES.some((t) => type.includes(t));

// Appends feeds whose URL isn't already listed.
function addUnique(feeds, candidates) {
  for (const feed of candidates) {
    if (!feeds.some((f) => f.url === feed.url)) feeds.push(feed);
  }
  return feeds;
}

/** Feed links advertised in a page: <link rel="alternate"> tags, then feed-like anchors. */
export function feedsInHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  const feeds = [];
  $(FEED_LINK_SELECTOR).each((_, el) => {
    const href = $(el).attr('href');
    if (href) feeds.push({ url: new URL(href, baseUrl).href, title: $(el).attr('title') || '', type: 'discovered' });
  });
  const anchors = [];
  $(FEED_ANCHOR_SELECTOR).each((_, el) => {
    const href = $(el).attr('href');
    if (href && looksLikeFeedHref(href)) {
      anchors.push({ url: new URL(href, baseUrl).href, title: $(el).text().trim(), type: 'link' });
    }
  });
  return addUnique(feeds, anchors);
}

async function fetchPageFeeds(baseUrl, request) {
  try {
    const response = await safeFetch(baseUrl.href, {
      headers: {
        'User-Agent': 'RSS-Feed-Reader/1.0',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    }, request);
    return response.ok ? feedsInHtml(await response.text(), baseUrl) : [];
  } catch {
    return []; // HTML fetch failed; the caller falls back to probing
  }
}

async function probePath(path, baseUrl, request) {
  const probeUrl = new URL(path, baseUrl).href;
  try {
    const resp = await safeFetch(probeUrl, {
      method: 'HEAD',
      headers: { 'User-Agent': 'RSS-Feed-Reader/1.0' },
      signal: AbortSignal.timeout(5000),
    }, request);
    const contentType = resp.headers.get('content-type') || '';
    if (resp.ok && isFeedContentType(contentType)) return { url: probeUrl, title: '', type: 'probed' };
  } catch {
    // Probe failed
  }
  return null;
}

/**
 * Discover RSS/Atom feed URLs from a given website URL: feeds the page
 * advertises, or else whichever common feed paths respond like a feed.
 * `request` is the single-hop HTTP call, as in safeFetch (tests pass a stub).
 */
export async function discoverFeeds(websiteUrl, request = guardedRequest) {
  // Rejects loopback/private/link-local targets before any server-side fetch.
  const baseUrl = await assertPublicHttpUrl(websiteUrl);
  const feeds = await fetchPageFeeds(baseUrl, request);
  if (feeds.length > 0) return feeds;
  const probed = await Promise.all(COMMON_FEED_PATHS.map((path) => probePath(path, baseUrl, request)));
  return addUnique([], probed.filter(Boolean));
}
