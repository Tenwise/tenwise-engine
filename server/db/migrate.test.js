import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migrate, getSchemaVersion, validateMigrations } from './migrate.js';
import { MIGRATIONS as READER } from './migrations/reader.js';

const createNotes = { version: 1, up: (db) => db.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT)') };
const addTitle = { version: 2, up: (db) => db.exec('ALTER TABLE notes ADD COLUMN title TEXT') };

test('applies pending migrations in order and records the version', () => {
  const db = new Database(':memory:');
  assert.deepEqual(migrate(db, [createNotes, addTitle]), [1, 2]);
  assert.equal(getSchemaVersion(db), 2);
  db.prepare('INSERT INTO notes (body, title) VALUES (?, ?)').run('b', 't');
});

test('runs each migration only once', () => {
  const db = new Database(':memory:');
  migrate(db, [createNotes]);
  assert.deepEqual(migrate(db, [createNotes, addTitle]), [2]);
  assert.deepEqual(migrate(db, [createNotes, addTitle]), []);
});

test('rolls back a failing migration and keeps the last good version', () => {
  const db = new Database(':memory:');
  const broken = {
    version: 2,
    up: (d) => { d.exec('ALTER TABLE notes ADD COLUMN title TEXT'); d.exec('NOT VALID SQL'); },
  };
  assert.throws(() => migrate(db, [createNotes, broken]));
  assert.equal(getSchemaVersion(db), 1);
  const columns = db.prepare('PRAGMA table_info(notes)').all().map((c) => c.name);
  assert.deepEqual(columns, ['id', 'body'], 'partial changes were rolled back');
});

test('rejects gaps or missing up() functions', () => {
  assert.throws(() => validateMigrations([createNotes, { version: 3, up: () => {} }]), /consecutive/);
  assert.throws(() => validateMigrations([{ version: 1 }]), /up\(\)/);
});

test('the app schema adopts an existing pre-migration database without data loss', () => {
  for (const migrations of [READER]) {
    // A database created before migrations existed: the v1 schema with user_version 0.
    const legacy = new Database(':memory:');
    migrations[0].up(legacy);
    const [{ name: table }] = legacy.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
    const before = legacy.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

    assert.deepEqual(migrate(legacy, migrations), migrations.map((m) => m.version));
    assert.equal(getSchemaVersion(legacy), migrations.length);
    assert.equal(legacy.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, before);
  }
});

test('reader migration 2 backfills plain-text excerpts for existing articles', () => {
  const db = new Database(':memory:');
  migrate(db, READER.slice(0, 1));
  db.prepare("INSERT INTO feeds (title, url, created_at) VALUES ('F', 'https://f.example/rss', 'now')").run();
  const insert = db.prepare(
    "INSERT INTO articles (feed_id, guid, summary, content, created_at) VALUES (1, ?, ?, ?, 'now')"
  );
  insert.run('a', '<p>Short &amp; <b>sweet</b></p>', '<p>ignored when summary exists</p>');
  insert.run('b', null, `<div>${'long '.repeat(200)}</div>`);
  insert.run('c', null, null);

  migrate(db, READER);
  const excerpts = db.prepare('SELECT guid, excerpt FROM articles ORDER BY guid').all();
  assert.equal(excerpts[0].excerpt, 'Short & sweet');
  assert.equal(excerpts[1].excerpt.length, 300);
  assert.equal(excerpts[2].excerpt, '');
});

test('reader migration 4 adds the favicon cache and points Google favicon URLs at the local route', () => {
  const db = new Database(':memory:');
  migrate(db, READER.slice(0, 3));
  const insert = db.prepare("INSERT INTO feeds (title, url, favicon, created_at) VALUES ('F', ?, ?, 'now')");
  insert.run('https://a.example/rss', 'https://www.google.com/s2/favicons?domain=www.theverge.com&sz=32');
  insert.run('https://b.example/rss', 'https://cdn.example.com/icon.png');
  insert.run('https://c.example/rss', null);

  migrate(db, READER);
  const icons = db.prepare('SELECT favicon FROM feeds ORDER BY id').all().map((r) => r.favicon);
  assert.deepEqual(icons, ['/api/favicon/www.theverge.com', 'https://cdn.example.com/icon.png', null]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM favicons').get().n, 0);
});

test('reader migration 5 adds the last refresh error to feeds', () => {
  const db = new Database(':memory:');
  migrate(db, READER.slice(0, 5));
  db.prepare("INSERT INTO feeds (title, url, created_at, last_error, last_error_at) VALUES ('F', 'https://f.example/rss', 'now', 'Bad XML', '2026-10-19')").run();
  assert.deepEqual(db.prepare('SELECT last_error, last_error_at FROM feeds').get(), { last_error: 'Bad XML', last_error_at: '2026-10-19' });
  assert.equal(db.pragma('user_version', { simple: true }), 5);
});

test('reader migration 6 adds the summaries and highlights tables', () => {
  const db = new Database(':memory:');
  migrate(db, READER.slice(0, 6));
  db.prepare("INSERT INTO summaries (created_at, summary_text) VALUES ('now', 'S')").run();
  db.prepare("INSERT INTO highlights (created_at, highlighted_text, article_url) VALUES ('now', 'H', 'https://a.example')").run();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM summaries').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM highlights').get().n, 1);
});

test('reader migration 7 adds Studio items whose sources are deleted with them', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  migrate(db, READER.slice(0, 7));
  const { lastInsertRowid: id } = db.prepare("INSERT INTO studio_items (kind, title, body_md, created_at, updated_at) VALUES ('newsletter', 'T', 'B', 'now', 'now')").run();
  db.prepare("INSERT INTO studio_item_sources (item_id, position, article_url) VALUES (?, 0, 'u')").run(id);
  db.prepare('DELETE FROM studio_items WHERE id = ?').run(id);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM studio_item_sources').get().n, 0);
  assert.equal(db.pragma('user_version', { simple: true }), 7);
});

test('reader migration 8 lets a Studio item remember its design', () => {
  const db = new Database(':memory:');
  migrate(db, READER.slice(0, 8));
  db.prepare("INSERT INTO studio_items (kind, title, body_md, created_at, updated_at, template) VALUES ('newsletter', 'T', 'B', 'now', 'now', 'evening')").run();
  assert.equal(db.prepare('SELECT template FROM studio_items').get().template, 'evening');
  assert.equal(db.pragma('user_version', { simple: true }), 8);
});

test('reader migration 9 dates existing saves and adds notes', () => {
  const db = new Database(':memory:');
  migrate(db, READER.slice(0, 8));
  db.prepare("INSERT INTO feeds (title, url, created_at) VALUES ('F', 'u', 'now')").run();
  const insert = db.prepare("INSERT INTO articles (feed_id, guid, is_bookmarked, created_at) VALUES (1, ?, ?, '2026-10-01T00:00:00.000Z')");
  insert.run('saved', 1);
  insert.run('unsaved', 0);
  migrate(db, READER.slice(0, 9));
  const rows = db.prepare('SELECT guid, saved_at, note FROM articles ORDER BY guid').all();
  assert.deepEqual(rows, [
    { guid: 'saved', saved_at: '2026-10-01T00:00:00.000Z', note: null },
    { guid: 'unsaved', saved_at: null, note: null },
  ]);
  assert.equal(db.pragma('user_version', { simple: true }), 9);
});

test('reader migration 10 adds collections whose items go with their article or collection', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  migrate(db, READER.slice(0, 10));
  db.prepare("INSERT INTO feeds (title, url, created_at) VALUES ('F', 'u', 'now')").run();
  db.prepare("INSERT INTO articles (feed_id, guid, created_at) VALUES (1, 'a', 'now'), (1, 'b', 'now')").run();
  db.prepare("INSERT INTO collections (name, created_at, updated_at) VALUES ('Evals', 'now', 'now')").run();
  assert.throws(() => db.prepare("INSERT INTO collections (name, created_at, updated_at) VALUES ('evals', 'now', 'now')").run());
  db.prepare("INSERT INTO collection_items (collection_id, article_id, added_at) VALUES (1, 1, 'now'), (1, 2, 'now')").run();
  db.prepare('DELETE FROM articles WHERE id = 1').run();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM collection_items').get().n, 1);
  db.prepare('DELETE FROM collections WHERE id = 1').run();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM collection_items').get().n, 0);
  assert.equal(db.pragma('user_version', { simple: true }), 10);
});

test('reader migration 11 marks existing summaries as written by the batch', () => {
  const db = new Database(':memory:');
  migrate(db, READER.slice(0, 10));
  db.prepare("INSERT INTO feeds (title, url, created_at) VALUES ('F', 'https://f.example/rss', 'now')").run();
  const insert = db.prepare("INSERT INTO articles (feed_id, guid, ai_summary, created_at) VALUES (1, ?, ?, 'now')");
  insert.run('a', 'A batch summary');
  insert.run('b', null);
  insert.run('c', '');
  migrate(db, READER.slice(0, 11));
  const sources = db.prepare('SELECT guid, ai_summary_source AS s FROM articles ORDER BY guid').all().map((r) => r.s);
  assert.deepEqual(sources, ['batch', null, null]);
});

test('reader migration 12 lets a feed be marked removed', () => {
  const db = new Database(':memory:');
  migrate(db, READER.slice(0, 12));
  db.prepare("INSERT INTO feeds (title, url, created_at, removed_at) VALUES ('F', 'u', 'now', 'then')").run();
  assert.equal(db.prepare('SELECT removed_at FROM feeds').get().removed_at, 'then');
  assert.equal(db.pragma('user_version', { simple: true }), 12);
});
