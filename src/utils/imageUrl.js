// Pictures from feeds and article pages are URLs a stranger chose. An <img>
// pointing at this app is a GET that carries the reader's session cookie, so
// a feed could make the browser call the app's own API just by being looked
// at (SEC-022). Only absolute http(s) URLs on a host unrelated to the app's
// are loaded: not the app's host, nor a parent or sub-domain of it (those
// share its cookies' site, e.g. www.tenwise.app or sandbox.tenwise.app).
//
// One narrow exception: a host a plugin names in the `imageHosts` slot, such
// as the hosted image proxy (img.tenwise.app), which serves only signed
// images, sets no cookies, and gets none of the app's (its sign-in cookies
// are __Host- cookies, sent to the app's own host alone). Exactly that host:
// not its subdomains, never the app's own host.
import { pluginsOf } from '../plugins/index.js';

const related = (a, b) => a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);

/** The hosts plugins say serve images safely on the app's site (`imageHosts`), lowercased; [] for none. */
export function trustedImageHosts(origin) {
  return pluginsOf('imageHosts').flatMap((h) => h.hosts(origin) ?? []).filter((h) => typeof h === 'string' && h).map((h) => h.toLowerCase());
}

/**
 * `url` if it's an absolute http(s) URL on a host unrelated to `origin`'s,
 * or on exactly one of `trusted` (other than the app's own); null otherwise.
 */
export function foreignImageUrl(url, origin, trusted = trustedImageHosts(origin)) {
  const text = typeof url === 'string' ? url.trim() : '';
  if (!/^https?:\/\//i.test(text)) return null;
  let host;
  try {
    host = new URL(text).hostname;
  } catch {
    return null;
  }
  let own = '';
  try {
    own = new URL(origin).hostname;
  } catch { /* no origin known: nothing to compare with */ }
  return own && related(host, own) && !trustedHere(host, own, trusted) ? null : text;
}

// A trusted host is let through on the app's site, but never the app's own host.
const trustedHere = (host, own, trusted) => host !== own && trusted.includes(host);

/** True when every candidate of a srcset is a foreign image URL (an empty srcset isn't). */
export function foreignSrcset(srcset, origin, trusted = trustedImageHosts(origin)) {
  const candidates = String(srcset ?? '').split(',').map((c) => c.trim().split(/\s+/)[0]).filter(Boolean);
  return candidates.length > 0 && candidates.every((c) => foreignImageUrl(c, origin, trusted) !== null);
}
