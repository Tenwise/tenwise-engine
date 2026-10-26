// "This machine only" checks, for an API with no auth by design.
import net from 'node:net';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** True for loopback names; *.localhost names always resolve to loopback (RFC 6761). */
export function isLocalHostname(hostname) {
  return LOOPBACK_HOSTS.has(hostname) || hostname.endsWith('.localhost');
}

/** The origin ("http://localhost:5173") when it is http(s) on this machine, else null. */
export function localOrigin(value) {
  try {
    const url = new URL(value);
    const ok = ['http:', 'https:'].includes(url.protocol) && isLocalHostname(url.hostname);
    return ok ? url.origin : null;
  } catch {
    return null;
  }
}

// What a Host header may hold: a name or an IP (IPv6 in brackets), and a port.
const HOST_HEADER = /^[a-z0-9._\-[\]:]+$/i;

/** The hostname in a Host header ("localhost:3001" → "localhost", "[::1]:3001" → "[::1]"), or null. */
export function hostHeaderName(value) {
  if (typeof value !== 'string' || !HOST_HEADER.test(value)) return null;
  try {
    return new URL(`http://${value}`).hostname;
  } catch {
    return null;
  }
}

const isIpLiteral = (hostname) => net.isIP(hostname.replace(/^\[(.*)\]$/, '$1')) !== 0;

/**
 * Whether to serve a request with this Host header. A page on another site
 * can point its own name at 127.0.0.1 (DNS rebinding) and then call the API
 * as "same-origin", with no Origin header; its Host still names that site.
 * So only local names, IP addresses (no DNS involved) and `boundHost`, the
 * HOST the server was started with, are accepted.
 */
export function hostAllowed(hostHeader, boundHost) {
  const name = hostHeaderName(hostHeader);
  if (!name) return false;
  return isLocalHostname(name) || isIpLiteral(name) || name === hostHeaderName(boundHost);
}

/** Whether a request's Origin may use the API: none (not a cross-site browser request), or a page on this machine. */
export const originAllowed = (origin) => !origin || localOrigin(origin) !== null;

/**
 * The one public origin a hosted install is served from ("https://learn.example.com"),
 * as a hosting plugin names it; null when unset or not a bare http(s) origin. Only for
 * installs that sit behind an authenticating proxy (e.g. Cloudflare Access):
 * the API itself still has no auth.
 */
export function publicOrigin(raw) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.origin !== raw.replace(/\/$/, '')) return null; // no path, query or credentials
    return url.origin;
  } catch {
    return null;
  }
}

/** Whether a request's Origin may use the API: originAllowed, or exactly the configured public origin. */
export const originAllowedFor = (origin, pub) => originAllowed(origin) || (pub !== null && origin === pub);

/** Whether to serve this Host header: hostAllowed, or the configured public origin's hostname. */
export function hostAllowedFor(hostHeader, boundHost, pub) {
  if (hostAllowed(hostHeader, boundHost)) return true;
  return pub !== null && hostHeaderName(hostHeader) === new URL(pub).hostname;
}

/**
 * Express middleware: 403 unless the request is addressed to this machine from
 * this machine (hostAllowed, originAllowed), or to and from `pub`, the public
 * origin a hosted install was started with (publicOrigin).
 */
export function localOnly(boundHost, pub = null) {
  return (req, res, next) => {
    if (!hostAllowedFor(req.headers.host, boundHost, pub)) return res.status(403).json({ error: 'Host not allowed' });
    if (!originAllowedFor(req.headers.origin, pub)) return res.status(403).json({ error: 'Origin not allowed' });
    return next();
  };
}
