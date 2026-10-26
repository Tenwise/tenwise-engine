import { createHash } from 'node:crypto';

// Normalization of incoming feed items before they are stored.

// Time zone abbreviations that Date.parse doesn't understand but feeds use.
const ZONE_OFFSETS = {
  IST: '+0530', JST: '+0900', KST: '+0900', AEST: '+1000', AEDT: '+1100',
  CET: '+0100', CEST: '+0200', BST: '+0100', EET: '+0200', EEST: '+0300',
  PST: '-0800', PDT: '-0700', MST: '-0700', MDT: '-0600',
  CST: '-0600', CDT: '-0500', EST: '-0500', EDT: '-0400',
};

const withNumericZone = (text) =>
  text.replace(/\b([A-Z]{3,4})\s*$/, (abbr) => ZONE_OFFSETS[abbr] ?? abbr);

/**
 * An ISO 8601 timestamp for a feed date, or `fallback` when it can't be read.
 * Stored dates must be ISO: views and sorting compare them as text, so a raw
 * "Sat, 18 Oct 2026 10:00:00 IST" would sort above every real date.
 */
export function normalizeDate(value, fallback) {
  if (!value) return fallback;
  const text = String(value).trim();
  const time = Date.parse(text) || Date.parse(withNumericZone(text));
  return Number.isFinite(time) && time > 0 ? new Date(time).toISOString() : fallback;
}

/**
 * The item's identity within its feed: its guid, else its link, else a hash of
 * its title, date and text. Without the hash, every item lacking both would
 * share the guid '' and only the first would ever be stored.
 */
export function itemGuid(item) {
  if (item.guid) return item.guid;
  if (item.link) return item.link;
  const basis = [item.title, item.publishedAt, item.summary || item.content].map((v) => v || '').join('\n');
  return `sha1:${createHash('sha1').update(basis).digest('hex')}`;
}
