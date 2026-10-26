// Names for screen readers in feed and article HTML, applied by sanitize.js's
// DOMPurify hooks. Kept out of sanitize.js, which needs a browser DOM to load,
// so these rules run under `node --test`.

/** "example.com/path" for a link's accessible name. */
export function readableUrl(href) {
  try {
    const url = new URL(href, 'https://x.invalid');
    return `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`.slice(0, 80);
  } catch { return 'link'; }
}

/**
 * An image with no alt attribute gets its title as alt text, or alt="" so a
 * screen reader skips it instead of reading out the file name. Alt text the
 * feed wrote, empty or not, is kept.
 */
export function giveAlt(img) {
  if (!img.hasAttribute('alt')) img.setAttribute('alt', (img.getAttribute('title') || '').trim());
}

/**
 * A link with nothing to read (a heading's empty anchor, an image without
 * alt text) has no name for a screen reader: an image link is named by its
 * URL; a link that shows nothing at all leaves the tab order. Its images get
 * their alt first: DOMPurify reaches a link before the elements inside it.
 */
export function nameEmptyLink(a) {
  a.querySelectorAll('img').forEach(giveAlt);
  if (a.textContent.trim() || a.querySelector('img[alt]:not([alt=""])')) return;
  if (a.querySelector('img, svg, picture, video')) {
    a.setAttribute('aria-label', `Link: ${readableUrl(a.getAttribute('href'))}`);
    return;
  }
  a.setAttribute('aria-hidden', 'true');
  a.setAttribute('tabindex', '-1');
}
