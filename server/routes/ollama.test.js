import { test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import router, { spawnOllama } from './ollama.js';
import { serveRouter } from './testServer.js';

// POST /start is left out: on a machine with Ollama installed it would start it.
let api;
before(async () => { api = await serveRouter(router); });
after(() => api.close());
afterEach(() => mock.restoreAll());

// Stands in for Ollama behind the global fetch; records the path and body of each call.
function stubOllama(answer) {
  const calls = [];
  mock.method(globalThis, 'fetch', async (url, init = {}) => {
    const { pathname } = new URL(url);
    calls.push({ path: pathname, body: init.body && JSON.parse(init.body) });
    return answer(pathname);
  });
  return calls;
}

const TAGS = {
  models: [
    { name: 'qwen3.5:4b', size: 3_400_000_000, details: { family: 'qwen3', parameter_size: '4B' } },
    { name: 'bare:1b', size: 1 },
  ],
};

const streamOf = (lines) => new ReadableStream({
  start(controller) {
    for (const line of lines) controller.enqueue(new TextEncoder().encode(line));
    controller.close();
  },
});

test('a missing ollama binary is a rejected promise, not a server crash', async () => {
  // Before, spawn() errors were emitted as an unhandled 'error' event, which
  // terminated the process; reaching the assertion at all proves otherwise.
  await assert.rejects(spawnOllama('/nonexistent/path/to/ollama'), /ENOENT/);
});

test('status: a running Ollama is installed, with its models and this computer’s memory', async () => {
  const calls = stubOllama(() => Response.json(TAGS));
  const { body } = await api.get('/status');
  assert.equal(body.installed, true);
  assert.equal(body.running, true);
  assert.deepEqual(body.models, [
    { name: 'qwen3.5:4b', family: 'qwen3', parameterSize: '4B', size: 3_400_000_000 },
    { name: 'bare:1b', family: '', parameterSize: '', size: 1 },
  ]);
  assert.ok(Number.isInteger(body.memoryGB) && body.memoryGB > 0);
  assert.deepEqual(calls.map((c) => c.path), ['/api/tags']);
});

test('status: an Ollama that errors or does not answer is not running', async () => {
  stubOllama(() => new Response('busy', { status: 500 }));
  const erroring = (await api.get('/status')).body;
  assert.equal(erroring.running, false);
  assert.deepEqual(erroring.models, []);
  assert.equal(typeof erroring.installed, 'boolean');

  stubOllama(() => { throw new TypeError('fetch failed'); });
  const silent = (await api.get('/status')).body;
  assert.equal(silent.running, false);
  assert.equal(typeof silent.installed, 'boolean');
});

test('pull needs a model name', async () => {
  const calls = stubOllama(() => new Response('{}'));
  assert.deepEqual((await api.post('/pull', {})).body, { error: 'model is required' });
  assert.deepEqual(calls, []);
});

test('pull streams Ollama’s progress lines back as they come', async () => {
  const lines = ['{"status":"pulling manifest"}\n', '{"status":"pulling","completed":5,"total":10}\n', '{"status":"success"}\n'];
  const calls = stubOllama(() => new Response(streamOf(lines)));
  const res = await api.post('/pull', { model: 'qwen3.5:4b' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/event-stream/);
  assert.equal(res.headers.get('cache-control'), 'no-cache');
  assert.equal(res.text, lines.join(''));
  assert.deepEqual(calls, [{ path: '/api/pull', body: { name: 'qwen3.5:4b', stream: true } }]);
});

test('a failed or unreachable pull ends the stream with an error line', async () => {
  stubOllama(() => new Response('no such model', { status: 404 }));
  assert.equal((await api.post('/pull', { model: 'nope' })).text, '{"error":"Pull request failed"}\n');
  stubOllama(() => { throw new Error('connect ECONNREFUSED 127.0.0.1:11434'); });
  assert.equal((await api.post('/pull', { model: 'nope' })).text, '{"error":"connect ECONNREFUSED 127.0.0.1:11434"}\n');
});
