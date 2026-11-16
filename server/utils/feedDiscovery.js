import * as cheerio from 'cheerio';
import { decodeBody, readCapped } from './fetchText.js';
import { parseFeedText } from './feedText.js';
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
];
// Guesses read to name them and find which are the same feed (PR-23), each
// within these limits: a feed's first bytes hold its title and newest item.
const MAX_READ = 12;
const READ_TIMEOUT_MS = 5000;
const READ_MAX_BYTES = 2 * 1024 * 1024;

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

// What makes two guesses the same feed: its title and newest item (/feed,
// /feed/, /rss and its Atom twin all match).
function sameAs(parsed, url) {
  const newest = parsed.items?.[0];
  return `${(parsed.title || '').trim()}\n${newest?.link || newest?.guid || parsed.link || url}`;
}

async function feedText(url, request) {
  const resp = await safeFetch(url, {
    headers: { 'User-Agent': 'RSS-Feed-Reader/1.0', 'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9' },
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  }, request);
  if (!resp.ok) throw new Error(`Status code ${resp.status}`);
  return decodeBody(await readCapped(resp, READ_MAX_BYTES), resp.headers.get('content-type'));
}

// A guess (a probed path, a feed-like link) read as a feed: named by its own
// title when it has none, with what makes it the same as another guess. Null
// when it doesn't parse as a feed, such as a page or a JSON API.
async function readGuess(feed, request) {
  try {
    const parsed = await parseFeedText(await feedText(feed.url, request));
    return { ...feed, title: feed.title || (parsed.title || '').trim(), same: sameAs(parsed, feed.url) };
  } catch {
    return null;
  }
}

/** One entry per distinct feed, the first of each kept, with `urls`: every address found for it. */
export function distinctFeeds(feeds) {
  const byKey = new Map();
  for (const { same, ...feed } of feeds) {
    const key = same ?? feed.url;
    if (byKey.has(key)) byKey.get(key).urls.push(feed.url);
    else byKey.set(key, { ...feed, urls: [feed.url] });
  }
  return [...byKey.values()];
}

// Feeds the page names in <link> tags are kept as they are; guesses are read,
// and dropped when they aren't feeds (PR-23).
async function checked(feeds, request) {
  const read = await Promise.all(feeds.map((feed, i) => (feed.type === 'discovered' || i >= MAX_READ ? feed : readGuess(feed, request))));
  return distinctFeeds(read.filter(Boolean));
}

/**
 * Discover RSS/Atom feed URLs from a given website URL: feeds the page
 * advertises, or else whichever common feed paths respond like a feed. Each
 * distinct feed is listed once, titled, with `urls` holding every address it
 * was found at (PR-23). `request` is the single-hop HTTP call, as in
 * safeFetch (tests pass a stub).
 */
export async function discoverFeeds(websiteUrl, request = guardedRequest) {
  // Rejects loopback/private/link-local targets before any server-side fetch.
  const baseUrl = await assertPublicHttpUrl(websiteUrl);
  const feeds = await fetchPageFeeds(baseUrl, request);
  if (feeds.length > 0) return checked(feeds, request);
  const probed = await Promise.all(COMMON_FEED_PATHS.map((path) => probePath(path, baseUrl, request)));
  return checked(addUnique([], probed.filter(Boolean)), request);
}
