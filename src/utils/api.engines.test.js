import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setPlugins } from '../plugins/index.js';
import { fetchAIModels, streamChat } from './api.js';

afterEach(() => setPlugins(null));

const engine = (models, tokens) => ({
  id: 'test',
  models: async () => models,
  handles: (name) => name.startsWith('test/'),
  async* streamChat(name, messages) { yield* tokens.map((t) => `${t}:${name}:${messages.length}`); },
});

test('streamChat sends a plugin engine’s model to that engine', async () => {
  setPlugins([{ aiEngines: [engine([], ['a', 'b'])] }]);
  const out = [];
  for await (const t of streamChat('test/m', [{ role: 'user', content: 'Hi' }])) out.push(t);
  assert.deepEqual(out, ['a:test/m:1', 'b:test/m:1']);
});

test('streamChat passes the purpose on to a plugin engine', async () => {
  const seen = [];
  setPlugins([{ aiEngines: [{ ...engine([], []), async* streamChat(name, messages, signal, options) { seen.push(options); yield 'x'; } }] }]);
  for await (const t of streamChat('test/m', [], undefined, { purpose: 'brief' })) assert.equal(t, 'x');
  for await (const t of streamChat('test/m', [])) assert.equal(t, 'x');
  assert.deepEqual(seen, [{ purpose: 'brief' }, {}]);
});

test('fetchAIModels lists plugin engines’ models, and an engine that fails offers none', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ models: [{ name: 'llama3:8b' }] });
  try {
    const failing = { ...engine([], []), models: async () => { throw new Error('down'); } };
    setPlugins([{ aiEngines: [engine([{ name: 'test/m', preferred: true }], []), failing] }]);
    const { models } = await fetchAIModels();
    assert.deepEqual(models.map((m) => m.name), ['test/m', 'llama3:8b']);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('fetchAIModels doesn’t ask for Ollama models where the app turns Ollama off', async () => {
  const realFetch = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (url) => { asked.push(String(url)); return Response.json({ models: [{ name: 'llama3:8b' }] }); };
  try {
    setPlugins([{ capabilities: [{ ollama: false }], aiEngines: [engine([{ name: 'test/m' }], [])] }]);
    const { models } = await fetchAIModels();
    assert.deepEqual(models.map((m) => m.name), ['test/m']);
    assert.ok(!asked.some((url) => url.includes('/ai/models')), 'no request to /api/ai/models');
  } finally {
    globalThis.fetch = realFetch;
  }
});
