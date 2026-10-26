/**
 * Minimal schema migration runner for SQLite.
 *
 * Each database tracks its schema version in SQLite's built-in
 * `PRAGMA user_version`. A migration is `{ version, description, up(db) }`;
 * versions must be consecutive integers starting at 1. Pending migrations
 * run in order, each inside its own transaction together with the version
 * bump, so a failing migration leaves the database at the last good version.
 *
 * Never edit a migration that has shipped — add a new one.
 */

export function validateMigrations(migrations) {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new Error(`Migration versions must be consecutive from 1; found ${m.version} at position ${i + 1}`);
    }
    if (typeof m.up !== 'function') {
      throw new Error(`Migration ${m.version} has no up() function`);
    }
  });
}

export function getSchemaVersion(db) {
  return db.pragma('user_version', { simple: true });
}

/** Applies pending migrations; returns the versions that ran. */
export function migrate(db, migrations) {
  validateMigrations(migrations);
  const current = getSchemaVersion(db);
  const pending = migrations.filter((m) => m.version > current);

  for (const m of pending) {
    db.transaction(() => {
      m.up(db);
      db.pragma(`user_version = ${m.version}`);
    })();
  }
  return pending.map((m) => m.version);
}
