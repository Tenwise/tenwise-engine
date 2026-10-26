import { existsSync, renameSync } from 'fs';
import { join } from 'path';

// Tables that used to have a database file of their own.
const LEGACY = [
  { file: 'summaries.db', table: 'summaries' },
  { file: 'highlights.db', table: 'highlights' },
];

const columnsOf = (db, schema, table) => db.prepare(`PRAGMA ${schema}.table_info(${table})`).all().map((c) => c.name);

// Copies the legacy table's rows (keeping their ids) into the main database.
// INSERT OR IGNORE makes a rerun after an interrupted merge harmless.
function copyRows(db, table) {
  const exists = db.prepare("SELECT 1 FROM legacy.sqlite_master WHERE type = 'table' AND name = ?").get(table);
  if (!exists) return 0;
  const legacyColumns = new Set(columnsOf(db, 'legacy', table));
  const shared = columnsOf(db, 'main', table).filter((c) => legacyColumns.has(c)).join(', ');
  return db.prepare(`INSERT OR IGNORE INTO main.${table} (${shared}) SELECT ${shared} FROM legacy.${table}`).run().changes;
}

// Moves the old file (and its WAL files) aside so it is merged only once.
function retire(path) {
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(path + suffix)) renameSync(path + suffix, `${path}${suffix}.merged`);
  }
}

function mergeOne(db, path, table) {
  db.prepare('ATTACH DATABASE ? AS legacy').run(path);
  let copied;
  try { copied = copyRows(db, table); } finally { db.exec('DETACH DATABASE legacy'); }
  retire(path);
  return copied;
}

/**
 * Merges summaries.db and highlights.db from `dir` into `db`, which must
 * already have both tables. Returns { table: rowsCopied } for each file found.
 */
export function mergeLegacyDatabases(db, dir) {
  const merged = {};
  for (const { file, table } of LEGACY) {
    const path = join(dir, file);
    if (existsSync(path)) merged[table] = mergeOne(db, path, table);
  }
  return merged;
}
