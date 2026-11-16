// The article sanitizer against known XSS payloads, in a real DOM (jsdom),
// as the reader runs it (SEC-28). Every result is parsed again and checked
// for anything that could run script or restyle the app.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { EMBED_HOSTS } from '../../../shared/embedHosts.js';

let sanitizeArticleHtml;
let sanitizeFeedHtml;
let dom;
before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://sandbox.tenwise.app/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'location', { value: dom.window.location, configurable: true });
  ({ sanitizeArticleHtml, sanitizeFeedHtml } = await import('./sanitize.js'));
});

const PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)><circle r="1"/></svg>',
  '<svg><script>alert(1)</script></svg>',
  '<a href="javascript:alert(1)">click</a>',
  '<a href=" JaVaScRiPt:alert(1)">click</a>',
  '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;:alert(1)">click</a>',
  '<a href="data:text/html,<script>alert(1)</script>">click</a>',
  '<a href="vbscript:msgbox(1)">click</a>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<iframe src="https://evil.example/phish"></iframe>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<object data="javascript:alert(1)"></object>',
  '<embed src="javascript:alert(1)">',
  '<form action="https://evil.example"><input name="password"><button>Sign in again</button></form>',
  '<div style="position:fixed;inset:0;background:red">overlay</div>',
  '<style>body{display:none}</style>',
  '<link rel="stylesheet" href="https://evil.example/x.css">',
  '<meta http-equiv="refresh" content="0;url=https://evil.example">',
  '<base href="https://evil.example/">',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  '<details open ontoggle=alert(1)>x</details>',
  '<body onload=alert(1)>',
  '<video><source onerror=alert(1)></video>',
  '<p onmouseover="alert(1)">hover</p>',
  '<img src="x" srcset="x 1x" onload="alert(1)">',
  '<button formaction="javascript:alert(1)">x</button>',
  '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>',
  '<svg><animate attributeName="href" values="javascript:alert(1)"/></svg>',
];

const SCRIPT_URL = /^\s*(javascript|vbscript|data:text\/html)/i;
const RISKY_TAGS = ['script', 'object', 'embed', 'form', 'input', 'button', 'style', 'link', 'meta', 'base', 'animate', 'set'];

const hostOf = (src) => { try { return new URL(src).hostname; } catch { return ''; } };

const URL_ATTRS = ['href', 'src', 'xlink:href', 'data'];
const RISKY_ATTRS = ['style', 'srcdoc', 'formaction', 'action'];

// An attribute that could run script or restyle the app, or null.
function riskyAttr(tag, { name, value }) {
  const lower = name.toLowerCase();
  if (lower.startsWith('on') || RISKY_ATTRS.includes(lower)) return `${tag}[${name}]`;
  return URL_ATTRS.includes(lower) && SCRIPT_URL.test(value) ? `${tag}[${name}=${value}]` : null;
}

// What in sanitized HTML could still run script or restyle the app.
function dangers(html) {
  const doc = new dom.window.DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
  const found = [];
  for (const el of doc.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase();
    if (RISKY_TAGS.includes(tag)) found.push(`<${tag}>`);
    if (tag === 'iframe' && !EMBED_HOSTS.includes(hostOf(el.getAttribute('src')))) found.push('iframe off the allowlist');
    found.push(...[...el.attributes].map((attr) => riskyAttr(tag, attr)).filter(Boolean));
  }
  return found;
}

for (const [name, sanitize] of [['sanitizeArticleHtml', () => sanitizeArticleHtml], ['sanitizeFeedHtml', () => sanitizeFeedHtml]]) {
  test(`${name}: no script, event handler, script URL, form or style survives (SEC-28)`, () => {
    for (const payload of PAYLOADS) assert.deepEqual(dangers(sanitize()(payload)), [], payload);
  });
}

test('the sanitizer keeps what an article needs: text, links in a new tab, images, an allowlisted video', () => {
  const html = sanitizeArticleHtml('<h2>Title</h2><p>Text with <a href="https://example.com/a">a link</a>.</p><img src="https://cdn.example/a.png" alt="A"><iframe src="https://www.youtube.com/embed/x"></iframe>');
  const doc = new dom.window.DOMParser().parseFromString(html, 'text/html');
  assert.equal(doc.querySelector('h2').textContent, 'Title');
  assert.equal(doc.querySelector('a').getAttribute('target'), '_blank');
  assert.equal(doc.querySelector('a').getAttribute('rel'), 'noopener noreferrer');
  assert.equal(doc.querySelector('img').getAttribute('src'), 'https://cdn.example/a.png');
  assert.match(doc.querySelector('iframe').getAttribute('sandbox'), /allow-scripts/);
});
