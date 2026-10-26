import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { collectResponse, streamTokens } from './tasks.js';
import { appendToLast } from '../components/ai-drawer/useArticleChat.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

// An Ollama-style NDJSON stream that emits one token per pull, recording
// whether the client cancelled it.
function ollamaStream(tokens, state) {
  const encoder = new TextEncoder();
  let i = 0;
  const body = new ReadableStream({
    pull(controller) {
      if (i < tokens.length) controller.enqueue(encoder.encode(`${JSON.stringify({ message: { content: tokens[i++] } })}\n`));
      else controller.close();
    },
    cancel() { state.cancelled = true; },
  });
  return new Response(body, { status: 200 });
}

test('aborting the signal stops the stream, cancels the request and is not an error', async () => {
  const state = { cancelled: false };
  globalThis.fetch = async (url, opts) => { state.signal = opts.signal; return ollamaStream(['a', 'b', 'c', 'd'], state); };
  const controller = new AbortController();
  const seen = [];
  await streamTokens('qwen2.5:3b', [{ role: 'user', content: 'hi' }], (t) => {
    seen.push(t);
    if (seen.length === 2) controller.abort();
  }, controller.signal);
  assert.deepEqual(seen, ['a', 'b']);
  assert.equal(state.signal, controller.signal, 'the fetch got the signal');
  assert.equal(state.cancelled, true, 'the response body was cancelled');
});

test('a stop function still works, and a full run collects every token', async () => {
  globalThis.fetch = async () => ollamaStream(['x', 'y', 'z'], {});
  assert.equal(await collectResponse('qwen2.5:3b', [], () => false), 'xyz');
  globalThis.fetch = async () => ollamaStream(['x', 'y', 'z'], {});
  let n = 0;
  assert.equal(await collectResponse('qwen2.5:3b', [], () => ++n > 2), 'xy');
});

test('errors still surface when nothing asked to stop', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'model not found' }), { status: 404 });
  await assert.rejects(streamTokens('nope', [], () => {}, new AbortController().signal), /model not found/);
});

test('appendToLast ignores tokens that arrive after the chat was reset', () => {
  assert.deepEqual(appendToLast('late')([]), []);
  assert.deepEqual(appendToLast('lo')([{ role: 'user', content: 'q' }, { role: 'assistant', content: 'hel' }]).at(-1), { role: 'assistant', content: 'hello' });
});
