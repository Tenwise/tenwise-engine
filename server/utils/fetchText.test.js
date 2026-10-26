import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeBody } from './fetchText.js';

const latin1 = (s) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));

test('decodeBody honours the Content-Type charset', () => {
  assert.equal(decodeBody(latin1('caf\xe9'), 'text/xml; charset=ISO-8859-1'), 'café');
});

test('decodeBody falls back to the XML declaration, then UTF-8', () => {
  const xml = latin1('<?xml version="1.0" encoding="iso-8859-1"?><t>na\xefve</t>');
  assert.match(decodeBody(xml, 'application/rss+xml'), /naïve/);
  assert.equal(decodeBody(new TextEncoder().encode('naïve ✓'), 'text/xml'), 'naïve ✓');
});

test('decodeBody survives an unknown charset label', () => {
  assert.equal(decodeBody(new TextEncoder().encode('ok'), 'text/xml; charset=x-made-up'), 'ok');
});
