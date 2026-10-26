import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import express from 'express';
import { EMBED_HOSTS } from '../../shared/embedHosts.js';
import { contentSecurityPolicy, inlineScriptHashes, securityHeaders } from './securityHeaders.js';

const sha256 = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
const directives = (csp) => Object.fromEntries(csp.split('; ').map((d) => { const [name, ...values] = d.split(' '); return [name, values]; }));

test('inlineScriptHashes hashes inline scripts exactly as written, and skips scripts with a src', () => {
  const html = '<script>\n  var a = 1;\n</script><script type="module" src="/assets/main.js"></script><SCRIPT data-x>b()</SCRIPT>';
  assert.deepEqual(inlineScriptHashes(html), [sha256('\n  var a = 1;\n'), sha256('b()')]);
  assert.deepEqual(inlineScriptHashes('<p>no scripts</p>'), []);
});

test('index.html has exactly one inline script, the theme bootstrap, and the CSP allows it by hash', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const hashes = inlineScriptHashes(html);
  assert.equal(hashes.length, 1, 'a new inline script needs its own CSP entry; prefer a module file');
  assert.match(html, /data-theme/);
  assert.deepEqual(directives(contentSecurityPolicy(hashes))['script-src'], ["'self'", ...hashes]);
});

test('the CSP refuses framing, plugins and other scripts, and frames only the embed hosts', () => {
  const csp = directives(contentSecurityPolicy());
  assert.deepEqual(csp['frame-ancestors'], ["'none'"]);
  assert.deepEqual(csp['script-src'], ["'self'"]);
  assert.deepEqual(csp['object-src'], ["'none'"]);
  assert.deepEqual(csp['base-uri'], ["'none'"]);
  assert.deepEqual(csp['connect-src'], ["'self'"]);
  assert.deepEqual(csp['frame-src'], EMBED_HOSTS.map((host) => `https://${host}`));
  assert.ok(!csp['script-src'].includes("'unsafe-inline'") && !csp['script-src'].includes("'unsafe-eval'"));
});

test('securityHeaders sets the headers on every response, and a route can replace the CSP', async () => {
  const app = express();
  app.use(securityHeaders("default-src 'self'"));
  app.get('/page', (req, res) => res.send('ok'));
  app.get('/icon', (req, res) => { res.set('Content-Security-Policy', "default-src 'none'; sandbox"); res.send('svg'); });
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(`${base}/page`);
    assert.equal(page.headers.get('content-security-policy'), "default-src 'self'");
    assert.equal(page.headers.get('x-frame-options'), 'DENY');
    assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
    const missing = await fetch(`${base}/nowhere`);
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('x-frame-options'), 'DENY');
    const icon = await fetch(`${base}/icon`);
    assert.equal(icon.headers.get('content-security-policy'), "default-src 'none'; sandbox");
    assert.equal(icon.headers.get('x-content-type-options'), 'nosniff');
  } finally {
    server.close();
  }
});
