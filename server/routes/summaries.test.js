import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { serveRouter } from './testServer.js';

let dataDir;
let api;
before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'tenwise-summary-routes-'));
  process.env.TENWISE_DATA_DIR = dataDir;
  const { default: router } = await import('./summaries.js');
  api = await serveRouter(router);
});
after(() => api.close());

const summary = (extra = {}) => ({
  summary_text: 'Chip prices fell 20% this quarter.',
  article_title: 'Chips get cheaper',
  article_url: 'https://news.example/chips',
  ai_model: 'gemini-nano',
  ai_personas: ['analyst', 'skeptic'],
  ai_tone_voice: '',
  ...extra,
});

test('saving a summary needs its text; personas are stored as JSON and empty fields as null', async () => {
  assert.deepEqual((await api.post('/', { summary_text: ' ' })).body, { error: 'summary_text is required' });
  const saved = await api.post('/', summary());
  assert.equal(saved.status, 201);
  assert.equal(saved.body.summary_text, 'Chip prices fell 20% this quarter.');
  assert.equal(saved.body.ai_personas, '["analyst","skeptic"]');
  assert.equal(saved.body.ai_tone_voice, null);
  assert.equal(saved.body.article_author, null);
  assert.equal((await api.post('/', summary({ ai_personas: 'analyst' }))).body.ai_personas, 'analyst');
  assert.equal((await api.post('/', summary({ ai_personas: undefined }))).body.ai_personas, null);
});

test('summaries list newest first and can be deleted', async () => {
  const older = (await api.post('/', summary({ article_title: 'Older' }))).body;
  await new Promise((resolve) => { setTimeout(resolve, 5); });
  const newer = (await api.post('/', summary({ article_title: 'Newer' }))).body;
  assert.deepEqual((await api.get('/')).body.slice(0, 2).map((s) => s.id), [newer.id, older.id]);

  assert.deepEqual((await api.delete(`/${older.id}`)).body, { ok: true });
  assert.equal((await api.delete(`/${older.id}`)).status, 404);
  assert.equal((await api.delete('/abc')).status, 400);
  assert.ok(!(await api.get('/')).body.some((s) => s.id === older.id));
});

test('the CSV export is a dated download that spreadsheets open safely', async () => {
  await api.post('/', summary({ summary_text: '+1 line one\nline two', article_title: 'Title, with comma' }));
  const res = await api.get('/export');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/csv; charset=utf-8/);
  assert.match(res.headers.get('content-disposition'), /^attachment; filename="tenwise-summaries-\d{4}-\d{2}-\d{2}\.csv"$/);
  assert.equal(res.text.charCodeAt(0), 0xfeff, 'starts with a BOM so Excel reads UTF-8');
  const csv = res.text.slice(1);
  assert.ok(csv.startsWith('ID,Saved At,Article Title,Article URL,Article Author,Article Source,Article Published,Summary,'));
  assert.match(csv, /,"Title, with comma",https:\/\/news\.example\/chips,,,,"'\+1 line one\nline two",gemini-nano,"\[""analyst"",""skeptic""\]",/);
});

test('the database path is reader.db in the data directory', async () => {
  assert.deepEqual((await api.get('/db-path')).body, { path: join(dataDir, 'reader.db') });
});
