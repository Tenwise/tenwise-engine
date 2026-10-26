import { db } from './database.js';

// Collections: named groups of saved articles. An article can be in several,
// and adding it to one saves it. Items go with their article (a removed feed
// takes its articles) and with their collection.

const stmts = {
  list: db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM collection_items i WHERE i.collection_id = c.id) AS item_count
    FROM collections c ORDER BY c.name COLLATE NOCASE, c.id
  `),
  get: db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM collection_items i WHERE i.collection_id = c.id) AS item_count
    FROM collections c WHERE c.id = ?
  `),
  insert: db.prepare(`
    INSERT INTO collections (name, description, created_at, updated_at) VALUES (@name, @description, @now, @now)
  `),
  update: db.prepare(`
    UPDATE collections SET name = COALESCE(@name, name), description = COALESCE(@description, description), updated_at = @now
    WHERE id = @id
  `),
  touch: db.prepare('UPDATE collections SET updated_at = ? WHERE id = ?'),
  delete: db.prepare('DELETE FROM collections WHERE id = ?'),
  addItem: db.prepare(`
    INSERT OR IGNORE INTO collection_items (collection_id, article_id, added_at)
    SELECT ?, id, ? FROM articles WHERE id = ?
  `),
  saveArticle: db.prepare('UPDATE articles SET is_bookmarked = 1, saved_at = COALESCE(saved_at, ?) WHERE id = ?'),
  removeItem: db.prepare('DELETE FROM collection_items WHERE collection_id = ? AND article_id = ?'),
  ofArticle: db.prepare('SELECT collection_id FROM collection_items WHERE article_id = ? ORDER BY collection_id'),
};

const toCollection = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description ?? null,
  count: row.item_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Every collection, by name, with how many articles each holds. */
export function listCollections() {
  return stmts.list.all().map(toCollection);
}

export function getCollection(id) {
  const row = stmts.get.get(id);
  return row ? toCollection(row) : null;
}

/** A name another collection already has (names are unique, ignoring case). */
export class DuplicateNameError extends Error {}

function rethrowDuplicate(err) {
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new DuplicateNameError('A collection with that name already exists');
  throw err;
}

/** Creates a collection; throws DuplicateNameError when the name is taken. */
export function createCollection({ name, description }) {
  try {
    const { lastInsertRowid } = stmts.insert.run({ name, description: description ?? null, now: new Date().toISOString() });
    return getCollection(Number(lastInsertRowid));
  } catch (err) { return rethrowDuplicate(err); }
}

/** Renames and/or redescribes a collection; null if it doesn't exist. */
export function updateCollection(id, { name, description }) {
  try {
    const { changes } = stmts.update.run({ id, name: name ?? null, description: description ?? null, now: new Date().toISOString() });
    return changes ? getCollection(id) : null;
  } catch (err) { return rethrowDuplicate(err); }
}

/** Deletes a collection (its articles stay saved); false if it didn't exist. */
export function deleteCollection(id) {
  return stmts.delete.run(id).changes > 0;
}

/**
 * Adds articles to a collection, saving each one; ids that aren't articles
 * are skipped. Returns the collection, or null if it doesn't exist.
 */
export const addToCollection = db.transaction((id, articleIds) => {
  if (!stmts.get.get(id)) return null;
  const now = new Date().toISOString();
  for (const articleId of articleIds) {
    if (stmts.addItem.run(id, now, articleId).changes) stmts.saveArticle.run(now, articleId);
  }
  stmts.touch.run(now, id);
  return getCollection(id);
});

/** Takes articles out of a collection (they stay saved). Null if it doesn't exist. */
export const removeFromCollection = db.transaction((id, articleIds) => {
  if (!stmts.get.get(id)) return null;
  for (const articleId of articleIds) stmts.removeItem.run(id, articleId);
  stmts.touch.run(new Date().toISOString(), id);
  return getCollection(id);
});

/** Ids of the collections an article is in. */
export function collectionsOfArticle(articleId) {
  return stmts.ofArticle.all(articleId).map((r) => r.collection_id);
}
