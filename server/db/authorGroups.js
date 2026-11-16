import { db } from './database.js';

// Groups of a feed's authors (PR-26): the newsletter inbox feed's senders,
// organised in the sidebar. A sender is in at most one group, and may be
// hidden from the list without unsubscribing; its articles stay in the feed.
// Deleting a group ungroups its senders (ON DELETE SET NULL); removing the
// feed removes both (ON DELETE CASCADE).

export const MAX_GROUPS = 50;
export const MAX_GROUP_NAME = 80;
const MAX_AUTHOR = 300;

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const groupOut = (g) => ({ id: g.id, name: g.name, collapsed: Boolean(g.collapsed) });

function cleanName(name) {
  const clean = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim() : '';
  if (!clean) throw badRequest('A group needs a name');
  return clean.slice(0, MAX_GROUP_NAME);
}

function cleanAuthor(author) {
  const clean = typeof author === 'string' ? author.trim() : '';
  if (!clean || clean.length > MAX_AUTHOR) throw badRequest('author is required');
  return clean;
}

/** A feed's groups, oldest first, and its authors' settings: { groups: [{ id, name, collapsed }], authors: [{ author, groupId, hidden }] }. */
export function listAuthorGroups(feedId) {
  const groups = db.prepare('SELECT id, name, collapsed FROM author_groups WHERE feed_id = ? ORDER BY id').all(feedId).map(groupOut);
  const authors = db.prepare('SELECT author, group_id AS groupId, hidden FROM author_settings WHERE feed_id = ? ORDER BY author').all(feedId)
    .map((a) => ({ author: a.author, groupId: a.groupId ?? null, hidden: Boolean(a.hidden) }));
  return { groups, authors };
}

/** A new group on a feed; throws 404 for a feed that isn't there, 400 for no name or too many groups. */
export function createAuthorGroup(feedId, name) {
  const clean = cleanName(name);
  if (!db.prepare('SELECT 1 FROM feeds WHERE id = ?').get(feedId)) throw Object.assign(new Error('Not found'), { status: 404 });
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM author_groups WHERE feed_id = ?').get(feedId);
  if (n >= MAX_GROUPS) throw badRequest(`A feed has at most ${MAX_GROUPS} groups`);
  const { lastInsertRowid } = db.prepare('INSERT INTO author_groups (feed_id, name) VALUES (?, ?)').run(feedId, clean);
  return groupOut(db.prepare('SELECT id, name, collapsed FROM author_groups WHERE id = ?').get(lastInsertRowid));
}

/** Renames a group or folds it: { name?, collapsed? }; null when it isn't there. */
export function updateAuthorGroup(id, { name, collapsed } = {}) {
  if (name !== undefined) db.prepare('UPDATE author_groups SET name = ? WHERE id = ?').run(cleanName(name), id);
  if (collapsed !== undefined) db.prepare('UPDATE author_groups SET collapsed = ? WHERE id = ?').run(collapsed ? 1 : 0, id);
  const group = db.prepare('SELECT id, name, collapsed FROM author_groups WHERE id = ?').get(id);
  return group ? groupOut(group) : null;
}

/** Deletes a group; its authors become ungrouped. True if it was there. */
export function deleteAuthorGroup(id) {
  return db.prepare('DELETE FROM author_groups WHERE id = ?').run(id).changes > 0;
}

/**
 * An author's place on a feed: { groupId?, hidden? }, each left as it was
 * when not given. groupId null ungroups; a group must be the same feed's.
 * Returns { author, groupId, hidden }.
 */
function checkGroup(feedId, groupId) {
  if (groupId === undefined || groupId === null) return;
  const group = db.prepare('SELECT feed_id FROM author_groups WHERE id = ?').get(groupId);
  if (!group || group.feed_id !== feedId) throw badRequest('No such group on this feed');
}

// The author's place after a change: what was given, else what it was.
const nextPlace = (current, { groupId, hidden }) => ({
  groupId: groupId === undefined ? (current?.group_id ?? null) : groupId,
  hidden: hidden === undefined ? Boolean(current?.hidden) : Boolean(hidden),
});

export function setAuthorSettings(feedId, author, changes = {}) {
  const name = cleanAuthor(author);
  checkGroup(feedId, changes.groupId);
  if (!db.prepare('SELECT 1 FROM feeds WHERE id = ?').get(feedId)) throw Object.assign(new Error('Not found'), { status: 404 });
  const current = db.prepare('SELECT group_id, hidden FROM author_settings WHERE feed_id = ? AND author = ?').get(feedId, name);
  const next = nextPlace(current, changes);
  db.prepare(
    `INSERT INTO author_settings (feed_id, author, group_id, hidden) VALUES (?, ?, ?, ?)
     ON CONFLICT (feed_id, author) DO UPDATE SET group_id = excluded.group_id, hidden = excluded.hidden`,
  ).run(feedId, name, next.groupId, next.hidden ? 1 : 0);
  return { author: name, ...next };
}
