import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installPaths, ollamaBase, whichCommand } from './ollamaHost.js';

test('ollamaBase reads OLLAMA_HOST the way Ollama does', () => {
  assert.equal(ollamaBase(undefined), 'http://127.0.0.1:11434');
  assert.equal(ollamaBase(''), 'http://127.0.0.1:11434');
  assert.equal(ollamaBase('127.0.0.1:11435'), 'http://127.0.0.1:11435');
  assert.equal(ollamaBase('gpu-box'), 'http://gpu-box:11434');
  assert.equal(ollamaBase('http://gpu-box:8080/'), 'http://gpu-box:8080');
  assert.equal(ollamaBase('https://ollama.example.com'), 'https://ollama.example.com');
  assert.equal(ollamaBase('0.0.0.0'), 'http://127.0.0.1:11434');
  assert.equal(ollamaBase('0.0.0.0:11500'), 'http://127.0.0.1:11500');
});

test('ollamaBase falls back to the default for an unreadable value', (t) => {
  t.mock.method(console, 'warn', () => {});
  assert.equal(ollamaBase('http://'), 'http://127.0.0.1:11434');
});

test('install detection covers Windows and the macOS app', () => {
  assert.equal(whichCommand('win32'), 'where ollama');
  assert.equal(whichCommand('darwin'), 'which ollama');
  const windows = installPaths({ platform: 'win32', env: { LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local' } });
  assert.equal(windows.length, 1);
  assert.match(windows[0], /Programs[\\/]Ollama[\\/]ollama\.exe$/);
  assert.deepEqual(installPaths({ platform: 'win32', env: {} }), []);
  assert.ok(installPaths({ platform: 'darwin' }).includes('/Applications/Ollama.app/Contents/Resources/ollama'));
  assert.ok(!installPaths({ platform: 'linux' }).some((p) => p.startsWith('/Applications')));
});
