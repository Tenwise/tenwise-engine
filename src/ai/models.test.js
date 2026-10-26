import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isChatModel, nanoNeedsDownload, pickDefaultModel } from './models.js';
import { fitsMemory, recommendedModel, RECOMMENDED_MODELS } from './recommendedModels.js';
import { withoutThinking } from './thinking.js';

const nano = (availability) => ({ name: 'gemini-nano', availability });
const ollama = (...names) => names.map((name) => ({ name }));

test('Auto takes Gemini Nano once it is downloaded', () => {
  assert.equal(pickDefaultModel([nano('available'), ...ollama('llama3.2:3b')]), 'gemini-nano');
});

test('Auto takes an installed Ollama model over Nano that still needs downloading', () => {
  assert.equal(pickDefaultModel([nano('downloadable'), ...ollama('llama3.2:3b')]), 'llama3.2:3b');
  assert.equal(pickDefaultModel([nano('downloading')]), 'gemini-nano');
  assert.equal(nanoNeedsDownload(nano('downloadable')), true);
  assert.equal(nanoNeedsDownload(nano('available')), false);
});

test('Auto prefers models that answer directly, and never an embedding model', () => {
  assert.equal(pickDefaultModel(ollama('deepseek-r1:7b', 'gemma3:4b')), 'gemma3:4b');
  assert.equal(pickDefaultModel(ollama('nomic-embed-text', 'deepseek-r1:7b')), 'deepseek-r1:7b');
  assert.equal(pickDefaultModel(ollama('nomic-embed-text', 'my-custom-model')), 'my-custom-model');
  assert.equal(isChatModel({ name: 'mxbai-embed-large' }), false);
  assert.equal(pickDefaultModel([]), '');
});

test('the suggested model fits the computer', () => {
  assert.equal(recommendedModel(8).name, 'llama3.2:3b');
  assert.equal(recommendedModel(16).name, 'gemma3:4b');
  assert.equal(recommendedModel(36).name, 'gemma3:12b');
  assert.equal(recommendedModel(4).name, 'llama3.2:3b');
  assert.equal(recommendedModel(undefined).name, 'llama3.2:3b');
  assert.equal(fitsMemory(RECOMMENDED_MODELS.at(-1), 16), false);
  assert.equal(fitsMemory(RECOMMENDED_MODELS.at(-1), undefined), true);
});

async function collect(chunks) {
  let out = '';
  for await (const text of withoutThinking((async function* () { yield* chunks; })())) out += text;
  return out;
}

test('withoutThinking drops <think> blocks, including tags split across chunks', async () => {
  assert.equal(await collect(['<think>let me see</think>\n\nThe answer.']), 'The answer.');
  assert.equal(await collect(['<thi', 'nk>hmm', ' more</th', 'ink>', '\n', 'Done']), 'Done');
  assert.equal(await collect(['Plain answer with a < sign']), 'Plain answer with a < sign');
  assert.equal(await collect(['Before ', '<think>x</think>', 'after']), 'Before after');
  assert.equal(await collect(['<think>never closed']), '');
});
