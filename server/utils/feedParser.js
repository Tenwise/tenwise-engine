import { fetchText } from './fetchText.js';
import { parseFeedText } from './feedText.js';
import { pluginFeedTitle } from '../plugins.js';

export { escapeBareAmpersands, NOT_A_FEED, parseFeedText } from './feedText.js';

const FEED_HEADERS = {
  'User-Agent': 'RSS-Feed-Reader/1.0',
  'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
};

// First truthy value, or '' when none is.
const firstOf = (...values) => values.find(Boolean) || '';

const itemHtml = (item) => firstOf(item.contentEncoded, item['content:encoded'], item.content);

/** Normalizes one rss-parser item into the shape the client stores. */
export function normalizeItem(item) {
  return {
    title: item.title || 'Untitled',
    link: item.link || '',
    content: firstOf(itemHtml(item), item.summary),
    summary: firstOf(item.contentSnippet, item.summary),
    author: firstOf(item.dcCreator, item.creator, item.author),
    publishedAt: firstOf(item.isoDate, item.pubDate) || new Date().toISOString(),
    guid: firstOf(item.guid, item.id, item.link),
    imageUrl: extractImageUrl(item),
    categories: item.categories || [],
  };
}

/** Normalizes an rss-parser feed. */
export function normalizeFeed(feed, feedUrl) {
  return {
    title: firstOf(pluginFeedTitle(feedUrl), feed.title, 'Untitled Feed'),
    description: firstOf(feed.description),
    link: firstOf(feed.link, feedUrl),
    feedUrl,
    language: firstOf(feed.language),
    image: firstOf(feed.image?.url, feed.itunes?.image),
    items: firstOf(feed.items, []).map(normalizeItem),
  };
}

/**
 * Parse an RSS/Atom feed URL and return structured data.
 */
export async function parseFeed(feedUrl) {
  const { text } = await fetchText(feedUrl, { headers: FEED_HEADERS })
    .catch((error) => { throw new Error(`Failed to parse feed: ${error.message}`, { cause: error }); });
  return normalizeFeed(await parseFeedText(text), feedUrl);
}

function enclosureImage(enclosure) {
  return enclosure?.type?.startsWith('image/') ? enclosure.url : '';
}

function firstImgSrc(html) {
  return html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || '';
}

/**
 * Extract the best image URL from a feed item: media tags, then an image
 * enclosure, then the first <img> in the content.
 */
export function extractImageUrl(item) {
  return firstOf(
    item.mediaContent?.$?.url,
    item.mediaThumbnail?.$?.url,
    enclosureImage(item.enclosure),
    firstImgSrc(itemHtml(item)),
  );
}
