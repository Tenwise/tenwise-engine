// What a parsed feed item is stored as, and the canonical link that spots the
// same story in two feeds. Shared by the browser (adding a feed) and the server
// (refreshing feeds), so both store identical rows and de-duplicate alike.

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'fbclid', 'gclid', 'msclkid', '_ga', 'mc_cid', 'mc_eid', 'ref', 'source',
]);

// Removes tracking params from a URL object; true if there were any.
function dropTrackingParams(u) {
  const tracking = [...u.searchParams.keys()].filter((key) => TRACKING_PARAMS.has(key.toLowerCase()));
  for (const key of tracking) u.searchParams.delete(key);
  return tracking.length > 0;
}

/** The URL without tracking params (utm_*, fbclid…), otherwise exactly as given. */
export function withoutTracking(url) {
  try {
    const u = new URL(url);
    return dropTrackingParams(u) ? u.toString() : url;
  } catch {
    return url;
  }
}

/**
 * Produce a canonical URL for cross-feed deduplication.
 * Strips tracking params and the www prefix, sorts params, and drops a
 * trailing slash. The #fragment is kept: feeds such as changelogs give each
 * item the same page with a different anchor (/changelog#v1.3, #v1.4), and
 * dropping it made every item after the first look like a duplicate.
 */
export function canonicalizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    dropTrackingParams(u);
    u.searchParams.sort();
    if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return url;
  }
}

// Optional text fields of a feed item, stored as '' when missing.
const OPTIONAL_ITEM_FIELDS = ['content', 'summary', 'author', 'imageUrl'];

/** Same as `a || b || …`: the first truthy value, else the last value. */
export function firstOf(...values) {
  return values.find(Boolean) ?? values[values.length - 1];
}

/** The value, or '' when it is missing or empty. */
export const orEmpty = (value) => firstOf(value, '');

/** Article record for the server from a parsed feed item. */
export function toArticle(item) {
  const { link } = item;
  return {
    ...Object.fromEntries(OPTIONAL_ITEM_FIELDS.map((key) => [key, orEmpty(item[key])])),
    guid: firstOf(item.guid, link),
    canonicalLink: firstOf(canonicalizeUrl(link), link, ''),
    title: item.title,
    link,
    publishedAt: firstOf(item.publishedAt, new Date().toISOString()),
  };
}
