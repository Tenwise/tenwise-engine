import DOMPurify from 'dompurify';
import { EMBED_HOSTS } from '../../../shared/embedHosts.js';
import { giveAlt, nameEmptyLink } from './accessibleMarkup.js';

// Feed HTML is untrusted. We allow <iframe> for legitimate video embeds only:
// any iframe whose src is not on this host allowlist is dropped, so a malicious
// feed cannot embed an arbitrary phishing/clickjacking frame in the trusted UI.
// The server's Content-Security-Policy allows frames from the same hosts only.
const IFRAME_HOST_ALLOWLIST = EMBED_HOSTS;

DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName !== 'iframe') return;
  let host = '';
  try { host = new URL(node.getAttribute('src') || '', 'https://x.invalid').hostname; }
  catch { /* invalid/relative src → leave host empty so the iframe is dropped */ }
  if (!IFRAME_HOST_ALLOWLIST.includes(host)) {
    node.parentNode?.removeChild(node);
  }
});

// Runs after attribute sanitization, so the forced values survive and override
// anything the feed set: iframes get a fixed sandbox; links open in a new tab,
// so following one never navigates the app itself away. Links and images get
// names for screen readers (accessibleMarkup.js). Code blocks scroll
// sideways, so they take keyboard focus to be scrollable without a mouse.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'IFRAME') {
    node.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups');
  }
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
    nameEmptyLink(node);
  }
  if (node.tagName === 'IMG') giveAlt(node);
  if (node.tagName === 'PRE') node.setAttribute('tabindex', '0');
});

// Feed HTML is shown inside the app, so it gets no interactive controls (a
// feed could otherwise render a fake "sign in again" form) and no inline
// styles (position:fixed overlays; the reader's own typography applies).
const BASE = {
  FORBID_TAGS: ['form', 'input', 'button', 'select', 'option', 'textarea', 'style'],
  FORBID_ATTR: ['style', 'action', 'formaction'],
};

/** Full article HTML, with allowlisted video iframes. */
export function sanitizeArticleHtml(html) {
  return DOMPurify.sanitize(html, {
    ...BASE,
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target'],
  });
}

/** Feed (RSS) HTML shown while full-text extraction runs. */
export function sanitizeFeedHtml(html) {
  return DOMPurify.sanitize(html, { ...BASE, ADD_ATTR: ['target'] });
}
