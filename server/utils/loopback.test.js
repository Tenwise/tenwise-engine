import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import express from 'express';
import { hostAllowed, hostAllowedFor, hostHeaderName, isLocalHostname, localOnly, localOrigin, originAllowed, originAllowedFor, publicOrigin } from './loopback.js';

test('loopback hostnames', () => {
  for (const host of ['localhost', '127.0.0.1', '::1', 'app.localhost']) assert.equal(isLocalHostname(host), true, host);
  for (const host of ['example.com', 'localhost.example.com', '10.0.0.1']) assert.equal(isLocalHostname(host), false, host);
});

test('localOrigin keeps only http(s) origins on this machine', () => {
  assert.equal(localOrigin('http://localhost:5173/some/path'), 'http://localhost:5173');
  assert.equal(localOrigin('http://127.0.0.1:4317'), 'http://127.0.0.1:4317');
  assert.equal(localOrigin('https://evil.example'), null);
  assert.equal(localOrigin('file:///etc/passwd'), null);
  assert.equal(localOrigin('javascript:alert(1)'), null);
  assert.equal(localOrigin(undefined), null);
});

test('hostHeaderName reads the hostname of a plain host[:port]', () => {
  assert.equal(hostHeaderName('localhost:3001'), 'localhost');
  assert.equal(hostHeaderName('LOCALHOST'), 'localhost');
  assert.equal(hostHeaderName('[::1]:3001'), '[::1]');
  assert.equal(hostHeaderName('tenwise-pulse.localhost:4317'), 'tenwise-pulse.localhost');
  for (const bad of [undefined, '', 'evil.example@127.0.0.1', '127.0.0.1/x', 'local host', 'localhost:abc']) {
    assert.equal(hostHeaderName(bad), null, String(bad));
  }
});

test('hostAllowed: local names and IP addresses, never another site', () => {
  const ok = ['localhost:3001', '127.0.0.1:3001', '[::1]:3001', 'tenwise-pulse.localhost:4317', '192.168.1.20:3001', '[fe80::1]'];
  for (const host of ok) assert.equal(hostAllowed(host, '127.0.0.1'), true, host);
  // A rebinding page's requests name the page's own site.
  const refused = ['attacker.example:3001', 'attacker.example', 'localhost.attacker.example', 'mymac.local:3001', undefined, 'evil.example@127.0.0.1'];
  for (const host of refused) assert.equal(hostAllowed(host, '127.0.0.1'), false, String(host));
});

test('hostAllowed accepts the name the server was deliberately started on', () => {
  assert.equal(hostAllowed('mymac.local:3001', 'mymac.local'), true);
  assert.equal(hostAllowed('MyMac.local:3001', 'mymac.local'), true);
  assert.equal(hostAllowed('attacker.example:3001', 'mymac.local'), false);
  assert.equal(hostAllowed('attacker.example:3001', '0.0.0.0'), false);
});

test('originAllowed: no Origin, or a page on this machine', () => {
  for (const origin of [undefined, '', 'http://localhost:5173', 'http://127.0.0.1:4317', 'http://tenwise.localhost:4317']) {
    assert.equal(originAllowed(origin), true, String(origin));
  }
  for (const origin of ['https://evil.example', 'http://localhost.evil.example', 'null', 'file:///x']) {
    assert.equal(originAllowed(origin), false, origin);
  }
});

// Real HTTP requests, since fetch won't let a test set its own Host header.
function get(port, headers) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path: '/api/data', headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('localOnly answers 403, without the data, to another site\'s Host or Origin', async () => {
  const app = express();
  app.use(localOnly('127.0.0.1'));
  app.get('/api/data', (req, res) => res.json({ secret: 'notes' }));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const { port } = server.address();
  try {
    assert.deepEqual(await get(port, { Host: `localhost:${port}` }), { status: 200, body: { secret: 'notes' } });
    assert.deepEqual(await get(port, { Host: `127.0.0.1:${port}`, Origin: 'http://localhost:5173' }), { status: 200, body: { secret: 'notes' } });
    assert.deepEqual(await get(port, { Host: `attacker.example:${port}` }), { status: 403, body: { error: 'Host not allowed' } });
    assert.deepEqual(await get(port, { Host: `localhost:${port}`, Origin: 'https://evil.example' }), { status: 403, body: { error: 'Origin not allowed' } });
  } finally {
    server.close();
  }
});

test('publicOrigin accepts only a bare http(s) origin', () => {
  assert.equal(publicOrigin('https://tenwise.app'), 'https://tenwise.app');
  assert.equal(publicOrigin('https://tenwise.app/'), 'https://tenwise.app');
  for (const bad of [undefined, '', 'tenwise.app', 'https://tenwise.app/app', 'https://u:p@tenwise.app', 'ftp://x.example']) {
    assert.equal(publicOrigin(bad), null, String(bad));
  }
});

test('the public origin is allowed only when configured, and only exactly', () => {
  const pub = 'https://tenwise.app';
  assert.equal(hostAllowedFor('tenwise.app', '127.0.0.1', pub), true);
  assert.equal(hostAllowedFor('tenwise.app', '127.0.0.1', null), false);
  assert.equal(hostAllowedFor('evil.codestrata.ai', '127.0.0.1', pub), false);
  assert.equal(hostAllowedFor('localhost:3001', '127.0.0.1', pub), true);
  assert.equal(originAllowedFor(pub, pub), true);
  assert.equal(originAllowedFor(pub, null), false);
  assert.equal(originAllowedFor('http://tenwise.app', pub), false);
  assert.equal(originAllowedFor('https://evil.example', pub), false);
  assert.equal(originAllowedFor(undefined, pub), true);
});
