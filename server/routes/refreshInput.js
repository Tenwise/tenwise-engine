// Request checks for routes/refresh.js, kept apart so they test without a database.

/**
 * The feed ids a refresh request names, or null when it names none (refresh
 * every feed). Throws a 400-style error unless feedIds is an array of integers.
 */
export function feedIdsFrom(body) {
  const { feedIds } = body;
  if (feedIds === undefined) return null;
  if (!Array.isArray(feedIds) || !feedIds.every(Number.isInteger)) {
    throw Object.assign(new Error('feedIds must be an array of feed ids'), { status: 400 });
  }
  return feedIds;
}
