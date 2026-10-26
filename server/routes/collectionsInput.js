// Request bodies for /api/collections, checked before anything is stored.

export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 500;
export const ARTICLES_MAX = 500;

const isText = (value) => typeof value === 'string';

function parseName(name, required) {
  if (name === undefined && !required) return { value: undefined };
  if (!isText(name) || !name.trim()) return { error: 'name is required' };
  if (name.trim().length > NAME_MAX) return { error: `name is longer than ${NAME_MAX} characters` };
  return { value: name.trim() };
}

function parseDescription(description) {
  if (description === undefined || description === null) return { value: undefined };
  if (!isText(description)) return { error: 'description must be text' };
  return { value: description.trim().slice(0, DESCRIPTION_MAX) };
}

const changesNothing = (value) => Object.values(value).every((v) => v === undefined);

/** { name, description } for a new collection (required) or an edit (either). */
export function parseCollection(body, { required }) {
  const name = parseName(body.name, required);
  if (name.error) return name;
  const description = parseDescription(body.description);
  if (description.error) return description;
  const value = { name: name.value, description: description.value };
  return changesNothing(value) ? { error: 'nothing to change' } : { value };
}

/** { articleIds } as positive integers, at most ARTICLES_MAX. */
export function parseArticleIds(body) {
  const ids = body.articleIds;
  if (!Array.isArray(ids) || ids.length === 0) return { error: 'articleIds[] is required' };
  if (ids.length > ARTICLES_MAX) return { error: `at most ${ARTICLES_MAX} articles at a time` };
  if (!ids.every((id) => Number.isInteger(id) && id > 0)) return { error: 'articleIds must be positive integers' };
  return { value: [...new Set(ids)] };
}
