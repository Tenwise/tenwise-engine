import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { decodeBody, readCapped } from './fetchText.js';

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

// A body that hands out `chunks` one at a time and counts how many were taken.
function chunked(chunks) {
  const taken = { n: 0 };
  const body = new ReadableStream({
    pull(controller) {
      if (taken.n === chunks.length) return controller.close();
      controller.enqueue(chunks[taken.n]);
      taken.n += 1;
    },
  });
  return { res: new Response(body), taken };
}

test('readCapped returns the whole body when it fits', async () => {
  const { res } = chunked([new TextEncoder().encode('<rss>'), new TextEncoder().encode('</rss>')]);
  assert.equal(new TextDecoder().decode(await readCapped(res, 11)), '<rss></rss>');
  assert.equal((await readCapped(new Response(null), 10)).length, 0);
});

test('readCapped stops reading as soon as the body passes the cap (SEC-023)', async () => {
  const { res, taken } = chunked(Array.from({ length: 100 }, () => new Uint8Array(1024)));
  await assert.rejects(readCapped(res, 10 * 1024), /Response too large/);
  assert.equal(taken.n, 11, 'not one chunk more than it took to pass the cap');
});

test('a small gzip body that would expand past the cap is refused without expanding it all', async () => {
  const bomb = gzipSync(Buffer.alloc(20 * 1024 * 1024));
  assert.ok(bomb.length < 64 * 1024, 'about 20 KB on the wire');
  let expanded = 0;
  const body = new Response(bomb).body.pipeThrough(new DecompressionStream('gzip')).pipeThrough(new TransformStream({
    transform(chunk, controller) {
      expanded += chunk.byteLength;
      controller.enqueue(chunk);
    },
  }));
  await assert.rejects(readCapped(new Response(body), 1024 * 1024), /Response too large/);
  assert.ok(expanded < 4 * 1024 * 1024, `expanded only ${expanded} bytes of 20 MB`);
});
