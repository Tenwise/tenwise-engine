// A link to one article, `/?article=<id>` (the hosted daily digest, GRO-4),
// or a page to save, `/?save=<address>` (the Save to Tenwise bookmarklet,
// BRF-08): the app acts on it once loaded, then takes the parameter out of
// the address so a reload doesn't do it again.

/** The article id in a query string, or null. */
export function articleIdFrom(search) {
  const raw = new URLSearchParams(search).get('article');
  const id = Number(raw);
  return raw && Number.isInteger(id) && id > 0 ? id : null;
}

/** The address without its `article` parameter. */
export function withoutArticle(href) {
  const url = new URL(href);
  url.searchParams.delete('article');
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The page address to save in a query string (http or https only), or null. */
export function pageToSaveFrom(search) {
  const raw = new URLSearchParams(search).get('save');
  return raw && /^https?:\/\//i.test(raw) && raw.length <= 2048 ? raw : null;
}

/** The address without one parameter. */
export function withoutParam(href, name) {
  const url = new URL(href);
  url.searchParams.delete(name);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The bookmarklet that opens Tenwise at `origin` to save the page it's pressed on. */
export const bookmarkletFor = (origin) => `javascript:void(window.open('${origin}/?save='+encodeURIComponent(location.href)))`;
