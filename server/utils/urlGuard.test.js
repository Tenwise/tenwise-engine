import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import dns from 'node:dns/promises';
import dnsCallback from 'node:dns';
import { assertPublicHttpUrl, guardedLookup, safeFetch } from './urlGuard.js';

afterEach(() => mock.restoreAll());

test('assertPublicHttpUrl rejects loopback, private, link-local, and non-http URLs', async () => {
  const blocked = [
    'http://127.0.0.1/',
    'http://169.254.169.254/latest/meta-data/', // cloud metadata
    'http://10.0.0.1/',
    'http://192.168.1.1/',
    'http://172.16.0.1/',
    'http://[::1]/',
    'file:///etc/passwd',
    'ftp://example.com/',
  ];
  for (const url of blocked) {
    await assert.rejects(() => assertPublicHttpUrl(url), `expected ${url} to be rejected`);
  }
});

test('assertPublicHttpUrl allows a public literal IP', async () => {
  const url = await assertPublicHttpUrl('http://93.184.216.34/');
  assert.equal(url.hostname, '93.184.216.34');
});

test('assertPublicHttpUrl blocks multicast and broadcast, and reads bracketed IPv6 literals', async () => {
  for (const blocked of ['http://224.0.0.251/', 'http://239.255.255.250/', 'http://255.255.255.255/', 'http://[ff02::1]/', 'http://[fd00::1]/']) {
    await assert.rejects(assertPublicHttpUrl(blocked), /Blocked/, blocked);
  }
  // A public IPv6 literal used to be refused as "not an IP" because URL keeps the brackets.
  const url = await assertPublicHttpUrl('http://[2606:4700:4700::1111]/');
  assert.equal(url.hostname, '[2606:4700:4700::1111]');
});

// The core regression guard: a public URL must not be able to redirect the
// server into a private/metadata address. If someone removes the per-hop
// re-validation from safeFetch, this test fails.
test('safeFetch blocks a redirect that points at a private address', async () => {
  const request = async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } });
  await assert.rejects(
    () => safeFetch('http://93.184.216.34/', {}, request), // literal public IP — no DNS needed
    /Blocked private or loopback address/,
  );
});

test('safeFetch returns a non-redirect response unchanged', async () => {
  const res = await safeFetch('http://93.184.216.34/', {}, async () => new Response('ok', { status: 200 }));
  assert.equal(res.status, 200);
});

test('safeFetch follows a redirect to another public address', async () => {
  let calls = 0;
  const request = async () => {
    calls += 1;
    return calls === 1
      ? new Response(null, { status: 301, headers: { location: 'http://93.184.216.35/' } })
      : new Response('final', { status: 200 });
  };
  const res = await safeFetch('http://93.184.216.34/', {}, request);
  assert.equal(res.status, 200);
  assert.equal(calls, 2);
});

test('guardedLookup refuses a name that resolves to a private address', async () => {
  const err = await new Promise((resolve) => guardedLookup('localhost', {}, (e) => resolve(e)));
  assert.equal(err?.code, 'EBLOCKED');
});

// DNS rebinding: the pre-check sees a public address, then the real
// connection's own lookup gets 127.0.0.1. The connect-time guard must refuse.
test('safeFetch refuses a host that rebinds to loopback after the check', async () => {
  let hits = 0;
  const server = createServer((req, res) => { hits += 1; res.end('secret'); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  mock.method(dns, 'lookup', async () => [{ address: '93.184.216.34', family: 4 }]); // the check's answer
  try {
    await assert.rejects(safeFetch(`http://localhost:${server.address().port}/`), (err) => /Blocked private or loopback address|fetch failed/.test(err.message));
    assert.equal(hits, 0);
  } finally {
    server.close();
  }
});

// URL rewrites an IPv6 literal's trailing a.b.c.d into hex groups, so
// [::ffff:127.0.0.1] arrives as [::ffff:7f00:1]. Addresses that carry an IPv4
// address must be judged by that IPv4, whichever way they are written.
test('assertPublicHttpUrl blocks IPv6 forms that carry a private IPv4 address', async () => {
  const blocked = [
    'http://[::ffff:127.0.0.1]/',      // IPv4-mapped, dotted
    'http://[::ffff:7f00:1]/',         // IPv4-mapped, hex
    'http://[::ffff:a9fe:a9fe]/',      // mapped 169.254.169.254 (metadata)
    'http://[0:0:0:0:0:ffff:a00:1]/',  // mapped 10.0.0.1, uncompressed
    'http://[::127.0.0.1]/',           // IPv4-compatible
    'http://[::7f00:1]/',
    'http://[64:ff9b::7f00:1]/',       // NAT64
    'http://[64:ff9b::a9fe:a9fe]/',
    'http://[2002:7f00:1::]/',         // 6to4
    'http://[2002:c0a8:101::1]/',      // 6to4 of 192.168.1.1
  ];
  for (const url of blocked) {
    await assert.rejects(assertPublicHttpUrl(url), /Blocked/, url);
  }
});

test('assertPublicHttpUrl blocks non-public IPv6 ranges', async () => {
  const blocked = [
    'http://[::]/', 'http://[0:0:0:0:0:0:0:1]/',
    'http://[fe80::1]/', 'http://[febf::1]/',  // link-local is fe80::/10, not only fe80::/16
    'http://[fec0::1]/',                       // site-local (deprecated)
    'http://[fc00::1]/',                       // unique-local
    'http://[ff05::1]/',                       // multicast
    'http://[100::1]/',                        // discard-only
    'http://[64:ff9b:1::1]/',                  // local-use NAT64
    'http://[2001::1]/',                       // Teredo
    'http://[2001:db8::1]/',                   // documentation
  ];
  for (const url of blocked) {
    await assert.rejects(assertPublicHttpUrl(url), /Blocked/, url);
  }
});

test('assertPublicHttpUrl allows IPv6 forms of a public IPv4 address', async () => {
  // 93.184.216.34 is 5db8:d822 in hex; NAT64 networks (DNS64) hand out such addresses for IPv4-only sites.
  for (const url of ['http://[::ffff:93.184.216.34]/', 'http://[64:ff9b::5db8:d822]/', 'http://[2002:5db8:d822::1]/', 'http://[2a00:1450:4001::200e]/']) {
    const parsed = await assertPublicHttpUrl(url);
    assert.ok(parsed.hostname.startsWith('['), url);
  }
});

test('guardedLookup refuses a DNS answer in IPv4-mapped form', async () => {
  mock.method(dnsCallback, 'lookup', (host, options, callback) => callback(null, [{ address: '::ffff:7f00:1', family: 6 }]));
  const err = await new Promise((resolve) => guardedLookup('mapped.example', {}, (e) => resolve(e)));
  assert.equal(err?.code, 'EBLOCKED');
});

test('safeFetch does not reach a loopback server through an IPv4-mapped literal', async () => {
  let hits = 0;
  const server = createServer((req, res) => { hits += 1; res.end('secret'); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    await assert.rejects(safeFetch(`http://[::ffff:127.0.0.1]:${server.address().port}/`), /Blocked private or loopback address/);
    assert.equal(hits, 0);
  } finally {
    server.close();
  }
});
