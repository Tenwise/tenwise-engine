import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { existsSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { migrate } from './migrate.js';
import { MIGRATIONS } from './migrations/reader.js';
import { mergeLegacyDatabases } from './legacyMerge.js';

// A summaries.db and highlights.db as the app used to write them.
function legacyFiles(dir) {
  const summaries = new Database(join(dir, 'summaries.db'));
  summaries.exec('CREATE TABLE summaries (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, article_url TEXT, summary_text TEXT NOT NULL, ai_model TEXT)');
  summaries.prepare("INSERT INTO summaries (id, created_at, article_url, summary_text, ai_model) VALUES (7, 't', 'https://a.example', 'Sum', 'nano')").run();
  summaries.close();
  const highlights = new Database(join(dir, 'highlights.db'));
  highlights.exec('CREATE TABLE highlights (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, article_url TEXT, highlighted_text TEXT NOT NULL, color TEXT)');
  highlights.prepare("INSERT INTO highlights (id, created_at, article_url, highlighted_text, color) VALUES (3, 't', 'https://a.example', 'Quote', 'blue')").run();
  highlights.close();
}

function mainDb(dir) {
  const db = new Database(join(dir, 'reader.db'));
  migrate(db, MIGRATIONS);
  return db;
}

test('copies legacy summaries and highlights with their ids, then retires the files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tenwise-merge-'));
  legacyFiles(dir);
  const db = mainDb(dir);

  assert.deepEqual(mergeLegacyDatabases(db, dir), { summaries: 1, highlights: 1 });
  assert.deepEqual(db.prepare('SELECT id, summary_text, ai_model FROM summaries').get(), { id: 7, summary_text: 'Sum', ai_model: 'nano' });
  assert.deepEqual(db.prepare('SELECT id, highlighted_text, color FROM highlights').get(), { id: 3, highlighted_text: 'Quote', color: 'blue' });
  assert.equal(existsSync(join(dir, 'summaries.db')), false);
  assert.equal(existsSync(join(dir, 'summaries.db.merged')), true);
  assert.equal(existsSync(join(dir, 'highlights.db.merged')), true);

  assert.deepEqual(mergeLegacyDatabases(db, dir), {}, 'nothing left to merge');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM summaries').get().n, 1);
});

test('a rerun after an interrupted merge does not duplicate rows', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tenwise-merge-'));
  legacyFiles(dir);
  const db = mainDb(dir);
  db.prepare("INSERT INTO summaries (id, created_at, summary_text) VALUES (7, 't', 'Sum')").run();

  assert.deepEqual(mergeLegacyDatabases(db, dir), { summaries: 0, highlights: 1 });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM summaries').get().n, 1);
});

test('does nothing when there are no legacy files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tenwise-merge-'));
  assert.deepEqual(mergeLegacyDatabases(mainDb(dir), dir), {});
});
