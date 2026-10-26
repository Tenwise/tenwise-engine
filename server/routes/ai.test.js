import { test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import router, { postChatWithoutThinking } from './ai.js';
import { serveRouter } from './testServer.js';

let api;
before(async () => { api = await serveRouter(router); });
after(() => api.close());
afterEach(() => mock.restoreAll());

// A stand-in for Ollama's /api/chat that records the bodies it gets.
function fakeOllama(answer) {
  const bodies = [];
  const post = async (body) => { bodies.push(body); return answer(body); };
  return { post, bodies };
}

const request = { model: 'qwen3.5:4b', messages: [{ role: 'user', content: 'hi' }], stream: true };

test('chat asks Ollama for the answer without the reasoning', async () => {
  const ollama = fakeOllama(() => new Response('{}', { status: 200 }));
  const res = await postChatWithoutThinking(request, ollama.post);
  assert.equal(res.status, 200);
  assert.deepEqual(ollama.bodies, [{ ...request, think: false }]);
});

test('an Ollama that refuses think for the model gets the plain request', async () => {
  const ollama = fakeOllama((body) => (body.think === false
    ? new Response('{"error":"\\"llama2\\" does not support thinking"}', { status: 400 })
    : new Response('{}', { status: 200 })));
  const res = await postChatWithoutThinking(request, ollama.post);
  assert.equal(res.status, 200);
  assert.deepEqual(ollama.bodies.map((b) => b.think), [false, undefined]);
});

test('other errors come back as they were, without a retry', async () => {
  const ollama = fakeOllama(() => new Response('model "nope" not found', { status: 400 }));
  const res = await postChatWithoutThinking(request, ollama.post);
  assert.equal(res.status, 400);
  assert.equal(await res.text(), 'model "nope" not found');
  assert.equal(ollama.bodies.length, 1);
});

// Stands in for Ollama behind the global fetch the routes use; records the path and body of each call.
function stubOllama(answer) {
  const calls = [];
  mock.method(globalThis, 'fetch', async (url, init = {}) => {
    calls.push({ path: new URL(url).pathname, body: init.body && JSON.parse(init.body) });
    return answer();
  });
  return calls;
}

const streamOf = (lines) => new ReadableStream({
  start(controller) {
    for (const line of lines) controller.enqueue(new TextEncoder().encode(line));
    controller.close();
  },
});

test('models: the installed models, or an empty list when Ollama is not there', async () => {
  const tags = { models: [{ name: 'qwen3.5:4b', size: 9, details: { family: 'qwen3', parameter_size: '4B' } }, { name: 'bare' }] };
  const calls = stubOllama(() => Response.json(tags));
  assert.deepEqual((await api.get('/models')).body, {
    models: [
      { name: 'qwen3.5:4b', family: 'qwen3', parameterSize: '4B', size: 9 },
      { name: 'bare', family: '', parameterSize: '' },
    ],
  });
  assert.deepEqual(calls.map((c) => c.path), ['/api/tags']);

  stubOllama(() => new Response('', { status: 500 }));
  assert.deepEqual((await api.get('/models')).body, { models: [], ollamaAvailable: false });
  stubOllama(() => { throw new TypeError('fetch failed'); });
  assert.deepEqual((await api.get('/models')).body, { models: [], ollamaAvailable: false });
});

test('chat needs a model and at least one message', async () => {
  const calls = stubOllama(() => Response.json({}));
  for (const body of [{}, { model: 'm' }, { model: 'm', messages: [] }, { model: 'm', messages: 'hi' }, { messages: request.messages }]) {
    const res = await api.post('/chat', body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.deepEqual(res.body, { error: 'model and messages[] are required' });
  }
  assert.deepEqual(calls, []);
});

test('chat without streaming returns Ollama\u2019s answer as JSON', async () => {
  const answer = { message: { role: 'assistant', content: 'Hello.' }, done: true };
  const calls = stubOllama(() => Response.json(answer));
  const res = await api.post('/chat', { ...request, stream: false });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, answer);
  assert.deepEqual(calls, [{ path: '/api/chat', body: { ...request, stream: false, think: false } }]);
});

test('chat streams Ollama\u2019s lines back as they come', async () => {
  const lines = ['{"message":{"content":"Hel"}}\n', '{"message":{"content":"lo"},"done":true}\n'];
  const calls = stubOllama(() => new Response(streamOf(lines)));
  const res = await api.post('/chat', { model: request.model, messages: request.messages });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/event-stream/);
  assert.equal(res.text, lines.join(''));
  assert.equal(calls[0].body.stream, true, 'streaming is the default');
});

test('chat passes Ollama\u2019s own errors on with its status', async () => {
  stubOllama(() => new Response('model "nope" not found, try pulling it first', { status: 404 }));
  const res = await api.post('/chat', request);
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: 'model "nope" not found, try pulling it first' });
});

test('chat says when Ollama is unreachable (503) or too slow (504)', async () => {
  stubOllama(() => { throw new TypeError('fetch failed'); });
  const down = await api.post('/chat', request);
  assert.equal(down.status, 503);
  assert.deepEqual(down.body, { error: 'Ollama is not reachable', detail: 'fetch failed' });

  stubOllama(() => { throw new DOMException('This operation was aborted', 'AbortError'); });
  const slow = await api.post('/chat', request);
  assert.equal(slow.status, 504);
  assert.match(slow.body.error, /did not respond in time/);
});
