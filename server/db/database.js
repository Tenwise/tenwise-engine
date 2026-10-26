import { join } from 'path';
import { DATA_DIR, openDatabase } from './connection.js';
import { mergeLegacyDatabases } from './legacyMerge.js';
import { MIGRATIONS } from './migrations/reader.js';

// The app's one SQLite database: feeds, articles, summaries, highlights.
// Summaries and highlights used to live in their own files; those are merged
// in (and renamed *.merged) the first time this opens.
const DB_FILE = 'reader.db';
export const DB_PATH = join(DATA_DIR, DB_FILE);

export const db = openDatabase(DB_FILE, MIGRATIONS);
mergeLegacyDatabases(db, DATA_DIR);
