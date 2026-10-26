import { createHash } from 'node:crypto';
import { EMBED_HOSTS } from '../../shared/embedHosts.js';

// Headers every response carries. The page itself must not be framed by
// another site, which could trick a click on something like "Delete all"
// (clickjacking), and the CSP is a second layer behind the HTML sanitizer: a
// script that slipped into article HTML still could not run or load.

const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;

/**
 * CSP sources for each inline `<script>` in a page, so the one index.html runs
 * before first paint (the saved theme) is allowed and nothing else inline is.
 */
export function inlineScriptHashes(html) {
  return [...html.matchAll(INLINE_SCRIPT)]
    .map(([, body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);
}

/**
 * The app's Content-Security-Policy. Styles allow 'unsafe-inline' because
 * Radix dialogs inject a <style> element at runtime; article HTML has its
 * style attributes removed by the sanitizer. Images and media load from the
 * publisher (https: and http:, as feeds use both); frames only from EMBED_HOSTS.
 */
export function contentSecurityPolicy(scriptHashes = []) {
  return [
    "default-src 'self'",
    ["script-src 'self'", ...scriptHashes].join(' '),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    `frame-src ${EMBED_HOSTS.map((host) => `https://${host}`).join(' ')}`,
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * Sets the headers before any route runs, so a route that needs a stricter
 * policy (site icons) can still replace them.
 */
export function securityHeaders(csp = contentSecurityPolicy()) {
  return (req, res, next) => {
    res.set('Content-Security-Policy', csp);
    res.set('X-Frame-Options', 'DENY');
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  };
}
