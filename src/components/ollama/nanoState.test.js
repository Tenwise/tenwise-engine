import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setPlugins } from '../../plugins/index.js';
import { nanoText } from './nanoState.js';

afterEach(() => setPlugins(null));

const FALLBACKS = ['unsupported-device', 'old-chrome', 'not-chrome'];

test('where Gemini Nano can’t run, the plain engine offers Ollama instead', () => {
  for (const state of FALLBACKS) assert.match(nanoText(state), /Ollama/, state);
  assert.match(nanoText('not-chrome'), /Open Tenwise in Chrome, or use Ollama\.$/);
});

test('with Ollama turned off, no message names it, and each still ends a sentence', () => {
  setPlugins([{ capabilities: [{ ollama: false }] }]);
  for (const state of FALLBACKS) {
    assert.doesNotMatch(nanoText(state), /Ollama/, state);
    assert.match(nanoText(state), /\.$/, state);
  }
  assert.equal(nanoText('not-chrome'), 'Gemini Nano is built into desktop Google Chrome (148+). Open Tenwise in Chrome.');
});

test('the other states read the same either way', () => {
  const plain = ['ready', 'downloadable', 'downloading'].map(nanoText);
  setPlugins([{ capabilities: [{ ollama: false }] }]);
  assert.deepEqual(['ready', 'downloadable', 'downloading'].map(nanoText), plain);
});
