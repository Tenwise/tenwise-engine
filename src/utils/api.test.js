import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { streamChat, fetchAIModels, parseFeed, patchFeed, streamModelPull } from './api.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

// A Response whose body arrives in the given pieces, to exercise line buffering.
function streamedResponse(pieces) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const p of pieces) controller.enqueue(encoder.encode(p));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

test('streamChat yields Ollama tokens across chunk boundaries and skips bad lines', async () => {
  globalThis.fetch = async () => streamedResponse([
    '{"message":{"content":"Hel"}}\n{"message":{"con',
    'tent":"lo"}}\nnot json\n\n',
    '{"message":{"content":"!"},"done":true}\n{"message":{"content":"ignored"}}\n',
  ]);
  let out = '';
  for await (const token of streamChat('qwen2.5:3b', [{ role: 'user', content: 'hi' }])) out += token;
  assert.equal(out, 'Hello!');
});

test('streamChat surfaces the server error message', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'model not found' }), { status: 404 });
  const run = async () => { for await (const _ of streamChat('missing', [{ role: 'user', content: 'hi' }])) { /* drain */ } };
  await assert.rejects(run, /model not found/);
});

test('fetchAIModels returns Ollama models when Gemini Nano is unavailable', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ models: [{ name: 'qwen2.5:3b' }] }));
  const { models } = await fetchAIModels();
  assert.deepEqual(models.map((m) => m.name), ['qwen2.5:3b']);
});

test('fetchAIModels fails only when neither engine is reachable', async () => {
  globalThis.fetch = async () => { throw new TypeError('network down'); };
  await assert.rejects(fetchAIModels(), /Could not reach the server/);
});

test('requests surface the server error, or a fallback when the body has none', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Feed not found' }), { status: 404 });
  await assert.rejects(parseFeed('https://x.example/rss'), /Feed not found/);
  globalThis.fetch = async () => new Response('<html>Oops</html>', { status: 500 });
  await assert.rejects(parseFeed('https://x.example/rss'), /Failed to parse feed/);
});

test('a request the server never answers says the server is unreachable', async () => {
  globalThis.fetch = async () => new Response('', { status: 502 }); // Vite's proxy, API down
  await assert.rejects(parseFeed('https://x.example/rss'), /Can't reach the Tenwise server/);
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(parseFeed('https://x.example/rss'), /Can't reach the Tenwise server/);
  globalThis.fetch = async () => { throw new DOMException('aborted', 'AbortError'); };
  await assert.rejects(parseFeed('https://x.example/rss'), { name: 'AbortError' });
});

test('reader requests send JSON with the right method and path', async () => {
  let call;
  globalThis.fetch = async (url, opts) => { call = { url, ...opts }; return Response.json({ id: 7 }); };
  assert.deepEqual(await patchFeed(7, { title: 'T' }), { id: 7 });
  assert.equal(call.url, '/api/reader/feeds/7');
  assert.equal(call.method, 'PUT');
  assert.equal(call.headers['Content-Type'], 'application/json');
  assert.equal(call.body, '{"title":"T"}');
});

test('a model pull that Ollama reports as failed throws instead of ending quietly', async () => {
  globalThis.fetch = async () => streamedResponse([
    '{"status":"pulling manifest"}\n',
    '{"error":"pull model manifest: file does not exist"}\n',
  ]);
  const seen = [];
  await assert.rejects(streamModelPull('nope:1b', (p) => seen.push(p.status)), /file does not exist/);
  assert.deepEqual(seen, ['pulling manifest']);
});
