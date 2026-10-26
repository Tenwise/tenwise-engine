import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { migrate } from './migrate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Local SQLite files live in data/ at the repo root. TENWISE_DATA_DIR overrides
// it (used by tests; also lets users keep data elsewhere).
// The variable's name before the project was named Tenwise still works, so an
// install that set it (the background service keeps it) finds its library.
export const DATA_DIR = process.env.TENWISE_DATA_DIR || process.env.ATLAS_DATA_DIR || join(__dirname, '../../data');

/**
 * Opens (creating if needed) a SQLite database in DATA_DIR with WAL mode and
 * foreign keys on, then brings its schema up to date.
 */
export function openDatabase(fileName, migrations) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(join(DATA_DIR, fileName));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db, migrations);
  return db;
}
