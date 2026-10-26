import { makeExcerpt, searchText } from '../../utils/text.js';

// Schema history for reader.db, the app's one database. Never edit a shipped migration; append a new one.
export const MIGRATIONS = [
  {
    version: 1,
    description: 'Initial schema: folders, feeds, articles',
    up: (db) => db.exec(`
  CREATE TABLE IF NOT EXISTS folders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feeds (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id      INTEGER REFERENCES folders(id),
    title          TEXT NOT NULL,
    url            TEXT NOT NULL UNIQUE,
    site_url       TEXT,
    favicon        TEXT,
    description    TEXT,
    last_refreshed TEXT,
    created_at     TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_feeds_folder_id ON feeds(folder_id);

  CREATE TABLE IF NOT EXISTS articles (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id        INTEGER NOT NULL REFERENCES feeds(id),
    guid           TEXT,
    title          TEXT,
    link           TEXT,
    canonical_link TEXT,
    published_at   TEXT,
    is_read        INTEGER DEFAULT 0,
    is_bookmarked  INTEGER DEFAULT 0,
    content        TEXT,
    summary        TEXT,
    author         TEXT,
    image_url      TEXT,
    description    TEXT,
    ai_status      TEXT DEFAULT 'none',
    ai_summary     TEXT,
    ai_analysis    TEXT,
    favicon        TEXT,
    created_at     TEXT NOT NULL,
    UNIQUE(feed_id, guid)
  );

  CREATE INDEX IF NOT EXISTS idx_articles_feed_id       ON articles(feed_id);
  CREATE INDEX IF NOT EXISTS idx_articles_is_read       ON articles(is_read);
  CREATE INDEX IF NOT EXISTS idx_articles_is_bookmarked ON articles(is_bookmarked);
  CREATE INDEX IF NOT EXISTS idx_articles_published_at  ON articles(published_at);
  CREATE INDEX IF NOT EXISTS idx_articles_ai_status     ON articles(ai_status);
  CREATE INDEX IF NOT EXISTS idx_articles_canonical_link ON articles(canonical_link);
  CREATE INDEX IF NOT EXISTS idx_articles_link          ON articles(link);
  `),
  },
  {
    version: 2,
    description: 'Add articles.excerpt (plain text) so list views can skip full content',
    up: (db) => {
      db.exec('ALTER TABLE articles ADD COLUMN excerpt TEXT');
      // Backfill in id-ordered batches to keep memory bounded on large libraries.
      const batch = db.prepare('SELECT id, summary, content FROM articles WHERE id > ? ORDER BY id LIMIT 500');
      const update = db.prepare('UPDATE articles SET excerpt = ? WHERE id = ?');
      let lastId = 0;
      for (let rows = batch.all(lastId); rows.length > 0; rows = batch.all(lastId)) {
        for (const row of rows) update.run(makeExcerpt(row.summary, row.content), row.id);
        lastId = rows[rows.length - 1].id;
      }
    },
  },
  {
    version: 3,
    description: 'Full-text index of article bodies (contentless FTS5)',
    up: (db) => {
      db.exec(`
        CREATE VIRTUAL TABLE articles_fts USING fts5(
          body, content='', contentless_delete=1, tokenize='porter unicode61'
        );
        CREATE TRIGGER articles_fts_delete AFTER DELETE ON articles BEGIN
          DELETE FROM articles_fts WHERE rowid = old.id;
        END;
      `);
      const batch = db.prepare('SELECT id, summary, content FROM articles WHERE id > ? ORDER BY id LIMIT 500');
      const index = db.prepare('INSERT INTO articles_fts (rowid, body) VALUES (?, ?)');
      let lastId = 0;
      for (let rows = batch.all(lastId); rows.length > 0; rows = batch.all(lastId)) {
        for (const row of rows) index.run(row.id, searchText(row.summary, row.content));
        lastId = rows[rows.length - 1].id;
      }
    },
  },
  {
    version: 4,
    description: "Favicon cache table; point stored favicons at the local /api/favicon route instead of Google's favicon service",
    up: (db) => {
      db.exec(`
        CREATE TABLE favicons (
          host       TEXT PRIMARY KEY,
          type       TEXT,
          body       BLOB,
          fetched_at TEXT NOT NULL
        )
      `);
      for (const table of ['feeds', 'articles']) {
        db.exec(`
          UPDATE ${table}
          SET favicon = '/api/favicon/' || replace(replace(favicon, 'https://www.google.com/s2/favicons?domain=', ''), '&sz=32', '')
          WHERE favicon LIKE 'https://www.google.com/s2/favicons?domain=%'
        `);
      }
    },
  },
  {
    version: 5,
    description: 'Remember why a feed last failed to refresh (shown in the sidebar)',
    up: (db) => {
      db.exec(`
        ALTER TABLE feeds ADD COLUMN last_error TEXT;
        ALTER TABLE feeds ADD COLUMN last_error_at TEXT;
      `);
    },
  },
  {
    version: 6,
    description: 'Summaries and highlights move into this database (from summaries.db and highlights.db)',
    up: (db) => db.exec(`
      CREATE TABLE IF NOT EXISTS summaries (
        id                     INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at             TEXT NOT NULL,
        article_title          TEXT,
        article_url            TEXT,
        article_author         TEXT,
        article_source         TEXT,
        article_published_at   TEXT,
        summary_text           TEXT NOT NULL,
        ai_model               TEXT,
        ai_personas            TEXT,
        ai_tone_voice          TEXT,
        ai_tone_energy         TEXT,
        ai_tone_angle          TEXT,
        ai_custom_instructions TEXT
      );
      CREATE TABLE IF NOT EXISTS highlights (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at       TEXT NOT NULL,
        article_url      TEXT,
        article_title    TEXT,
        article_source   TEXT,
        highlighted_text TEXT NOT NULL,
        note             TEXT,
        color            TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_highlights_article_url ON highlights(article_url);
    `),
  },
  {
    version: 7,
    description: 'Studio: saved, editable AI outputs (newsletters first) and the articles each was made from',
    up: (db) => db.exec(`
      CREATE TABLE studio_items (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        kind        TEXT NOT NULL,
        title       TEXT NOT NULL,
        body_md     TEXT NOT NULL,
        style       TEXT,
        model       TEXT,
        ai_settings TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
      CREATE INDEX idx_studio_items_updated_at ON studio_items(updated_at);
      CREATE TABLE studio_item_sources (
        item_id        INTEGER NOT NULL REFERENCES studio_items(id) ON DELETE CASCADE,
        position       INTEGER NOT NULL,
        article_id     INTEGER,
        article_url    TEXT,
        article_title  TEXT,
        article_source TEXT,
        PRIMARY KEY (item_id, position)
      );
    `),
  },
  {
    version: 8,
    description: 'Studio items remember their page design (null = the default design)',
    up: (db) => db.exec('ALTER TABLE studio_items ADD COLUMN template TEXT'),
  },
  {
    version: 9,
    description: 'Saves remember when they were made and carry an optional note',
    up: (db) => db.exec(`
      ALTER TABLE articles ADD COLUMN saved_at TEXT;
      ALTER TABLE articles ADD COLUMN note TEXT;
      UPDATE articles SET saved_at = created_at WHERE is_bookmarked = 1;
      CREATE INDEX idx_articles_saved_at ON articles(saved_at);
    `),
  },
  {
    version: 10,
    description: 'Collections: named groups of saved articles; an article can be in several',
    up: (db) => db.exec(`
      CREATE TABLE collections (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
        description TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
      CREATE TABLE collection_items (
        collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        article_id    INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        added_at      TEXT NOT NULL,
        PRIMARY KEY (collection_id, article_id)
      );
      CREATE INDEX idx_collection_items_article ON collection_items(article_id);
    `),
  },
  {
    version: 11,
    description: "Remember who wrote an article's summary: 'manual' (asked for in the reader) or 'batch'; the batch never replaces a manual one",
    up: (db) => db.exec(`
      ALTER TABLE articles ADD COLUMN ai_summary_source TEXT;
      UPDATE articles SET ai_summary_source = 'batch' WHERE ai_summary IS NOT NULL AND ai_summary <> '';
    `),
  },
  {
    version: 12,
    description: 'A removed feed with saved articles is kept, hidden, so its saves keep their source',
    up: (db) => db.exec('ALTER TABLE feeds ADD COLUMN removed_at TEXT'),
  },
];
