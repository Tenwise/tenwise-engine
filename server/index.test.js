import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// server/index.js listens as soon as it loads, so it runs in a child process on
// a free port with its own data directory. Told 'exit' over IPC, the child
// exits normally, so coverage tools still record what it ran.

const INDEX = fileURLToPath(new URL('./index.js', import.meta.url));
const EXIT_ON_MESSAGE = `data:text/javascript,${encodeURIComponent(
  "process.on('message', (m) => { if (m === 'exit') process.exit(0); });",
)}`;
const dataDir = mkdtempSync(join(tmpdir(), 'tenwise-server-'));

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

// Starts the server under `npm run dev` settings; `ready` resolves once it
// says it is up, or once it exits.
function startServer(port, env = {}) {
  const child = spawn(process.execPath, ['--import', EXIT_ON_MESSAGE, INDEX, '--dev'], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', TENWISE_DATA_DIR: dataDir, ...env },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { output += chunk; });
  const ready = new Promise((resolve) => {
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (output.includes(' is up on ')) resolve();
    });
    child.once('exit', resolve);
  });
  return { child, ready, output: () => output };
}

async function stop({ child }) {
  if (child.exitCode !== null) return;
  child.send('exit');
  await once(child, 'exit');
}

let port;
let server;
before(async () => {
  port = await freePort();
  server = startServer(port);
  await server.ready;
  assert.equal(server.child.exitCode, null, `the server did not start:\n${server.output()}`);
}, { timeout: 30_000 });
after(() => stop(server));

async function request(path, { headers = {}, at = port, ...init } = {}) {
  const res = await fetch(`http://127.0.0.1:${at}${path}`, { ...init, headers });
  const text = await res.text();
  const json = (res.headers.get('content-type') || '').includes('application/json');
  return { status: res.status, headers: res.headers, text, body: json ? JSON.parse(text) : undefined };
}

const postJson = (path, text) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text });

test('it says where it listens, and answers health checks', async () => {
  assert.match(server.output(), new RegExp(`Tenwise API is up on http://localhost:${port}\\. Open the app at http://localhost:5173`));
  const health = await request('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');
  assert.ok(!Number.isNaN(Date.parse(health.body.timestamp)));
});

test('outside /api, under npm run dev, it points to the app Vite serves', async () => {
  const page = await request('/some/page');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /^text\/plain/);
  assert.match(page.text, /Open the app at http:\/\/localhost:5173/);
});

test('pages on this machine may call the API; other sites may not', async () => {
  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:4317', 'http://app.localhost:5173']) {
    const res = await request('/api/health', { headers: { Origin: origin } });
    assert.equal(res.status, 200, origin);
    assert.equal(res.headers.get('access-control-allow-origin'), origin);
  }
  for (const origin of ['https://evil.example', 'http://localhost.evil.example', 'null']) {
    const res = await request('/api/health', { headers: { Origin: origin } });
    assert.ok(res.status >= 400, `${origin} got ${res.status}`);
    assert.equal(res.headers.get('access-control-allow-origin'), null, origin);
    assert.equal(res.body?.status, undefined, `${origin} must not get the response`);
  }
});

test('every response, refusals included, forbids framing and sniffing and carries the CSP', async () => {
  const responses = [
    await request('/api/health'),
    await request('/some/page'),
    await request('/api/health', { headers: { Origin: 'https://evil.example' } }),
  ];
  for (const res of responses) {
    assert.equal(res.headers.get('x-frame-options'), 'DENY', res.status);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff', res.status);
    assert.match(res.headers.get('content-security-policy') || '', /frame-ancestors 'none'/, res.status);
  }
});

test('bad JSON is a 400 in JSON, and a request without a body reads as empty', async () => {
  const bad = await postJson('/api/reader/folders', '{"name": ');
  assert.equal(bad.status, 400);
  assert.equal(typeof bad.body.error, 'string');
  const empty = await request('/api/reader/folders', { method: 'POST' });
  assert.equal(empty.status, 400);
  assert.deepEqual(empty.body, { error: 'name is required' });
});

test('bodies are capped at 2 MB, except bulk inserts, which take one very long article', async () => {
  const big = 'x'.repeat(3 * 1024 * 1024);
  const tooLarge = await postJson('/api/reader/folders', JSON.stringify({ name: big }));
  assert.equal(tooLarge.status, 413);
  assert.equal(typeof tooLarge.body.error, 'string');

  const feed = await postJson('/api/reader/feeds', JSON.stringify({ title: 'Long reads', url: 'https://long.example/rss' }));
  const articles = [{ guid: 'long', title: 'A very long article', content: `<p>${big}</p>` }];
  const inserted = await postJson('/api/reader/articles/bulk-insert', JSON.stringify({ feedId: feed.body.id, articles }));
  assert.equal(inserted.status, 201);
  assert.deepEqual(inserted.body, { inserted: 1 });
});

test('a port already in use stops the server with a message saying what to do', async () => {
  const second = startServer(port);
  await second.ready;
  if (second.child.exitCode === null) await once(second.child, 'exit');
  assert.equal(second.child.exitCode, 1);
  assert.match(second.output(), new RegExp(`Port ${port} is already in use`));
});

// A hosted install's public address comes only from a hosting plugin
// (server/plugins.js): the engine alone ignores PUBLIC_ORIGIN.
test('a public origin is accepted only when a hosting plugin names it', { timeout: 30_000 }, async () => {
  const PUBLIC = 'https://app.example.com';
  const fromPublic = { Origin: PUBLIC, Host: 'app.example.com' };
  const plain = { port: await freePort() };
  plain.server = startServer(plain.port, { PUBLIC_ORIGIN: PUBLIC });
  await plain.server.ready;
  try {
    assert.equal((await request('/api/health', { at: plain.port, headers: fromPublic })).status, 403);
  } finally {
    await stop(plain.server);
  }
  const plugins = join(dataDir, 'hosting-plugins.js');
  writeFileSync(plugins, `export default [{ id: 'hosting', publicOrigin: ${JSON.stringify(PUBLIC)} }];`);
  const hosted = { port: await freePort() };
  hosted.server = startServer(hosted.port, { TENWISE_SERVER_PLUGINS: plugins });
  await hosted.server.ready;
  try {
    const res = await request('/api/health', { at: hosted.port, headers: fromPublic });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), PUBLIC);
    assert.equal((await request('/api/health', { at: hosted.port, headers: { Origin: 'https://evil.example' } })).status, 403);
  } finally {
    await stop(hosted.server);
  }
});
