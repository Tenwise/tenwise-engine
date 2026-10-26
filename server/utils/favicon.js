import * as cheerio from 'cheerio';
import { safeFetch } from './urlGuard.js';

// Site icons are fetched by this server and cached in reader.db, so
// the browser never asks a third party (such as Google's favicon service)
// which sites the user follows.

const MAX_ICON_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 8000;
// "No icon" results are retried after a day, in case the failure was temporary.
const MISS_TTL_MS = 24 * 60 * 60 * 1000;
const HEADERS = { 'User-Agent': 'Tenwise/1.0 (+https://github.com/Tenwise/tenwise-engine)' };
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

/** True for a plain public-looking DNS name (no IPs, ports, paths or userinfo). */
export function isValidHostname(host) {
  return typeof host === 'string' && HOSTNAME.test(host);
}

const ICON_RELS = new Set(['icon', 'apple-touch-icon']);
const isIconRel = (rel) => rel.split(/\s+/).some((r) => ICON_RELS.has(r));
const get = (url) => safeFetch(url, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
const mimeType = (res) => (res.headers.get('content-type') || '').split(';')[0].trim();
const isImageResponse = (res) => res.ok && mimeType(res).startsWith('image/');
const isAcceptableSize = (body) => body.length > 0 && body.length <= MAX_ICON_BYTES;

// Prefer icons near 32px: explicit sizes closest to 32, then any icon, then
// apple-touch icons (large but usually present).
function iconScore(rel, sizes) {
  const size = Number.parseInt((sizes || '').split(/[x\s]/i)[0], 10);
  const sizePenalty = Number.isFinite(size) ? Math.abs(size - 32) : 16;
  return (rel.includes('apple-touch') ? 1000 : 0) + sizePenalty;
}

function toIcon($link, baseUrl) {
  try {
    const rel = $link.attr('rel').toLowerCase();
    return { url: new URL($link.attr('href'), baseUrl).href, score: iconScore(rel, $link.attr('sizes')) };
  } catch {
    return null; // malformed href
  }
}

/** Icon URLs advertised by a page's <link rel="…icon…"> tags, best first. */
export function iconLinksInHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  return $('link[rel][href]').toArray()
    .filter((el) => isIconRel($(el).attr('rel').toLowerCase()))
    .map((el) => toIcon($(el), baseUrl))
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .map((icon) => icon.url);
}

async function fetchIcon(url) {
  if (url.startsWith('data:')) return null;
  const res = await get(url);
  if (!isImageResponse(res)) return null;
  const body = Buffer.from(await res.arrayBuffer());
  return isAcceptableSize(body) ? { type: mimeType(res), body } : null;
}

async function candidateUrls(host) {
  const origin = `https://${host}/`;
  const fallback = new URL('/favicon.ico', origin).href;
  const res = await get(origin).catch(() => null);
  if (!res?.ok) return [fallback];
  return [...iconLinksInHtml(await res.text(), res.url || origin), fallback];
}

async function resolveIcon(host) {
  for (const url of await candidateUrls(host)) {
    const icon = await fetchIcon(url).catch(() => null);
    if (icon) return icon;
  }
  return null;
}

/**
 * Favicon cache over a store with read(host) → { type, body, fetchedAt } and
 * write(host, icon). `get(host)` returns { type, body } or null when the site
 * has no usable icon; that result is cached too and retried after a day.
 */
export function createFaviconCache(store) {
  const pending = new Map();

  async function load(host) {
    const cached = store.read(host);
    if (cached?.type) return { type: cached.type, body: cached.body };
    if (cached && Date.now() - Date.parse(cached.fetchedAt) < MISS_TTL_MS) return null;
    const icon = await resolveIcon(host);
    store.write(host, icon);
    return icon;
  }

  return {
    get(host) {
      // Concurrent requests for one host share a single fetch.
      if (!pending.has(host)) pending.set(host, load(host).finally(() => pending.delete(host)));
      return pending.get(host);
    },
  };
}
