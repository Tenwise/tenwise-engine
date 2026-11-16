// Changing articles in the cached lists in place (read, saved, a note) without
// making those lists look fresh. A patch isn't news from the server: a list
// that was out of date, such as a collection an article was just added to,
// must still be fetched again when it's next shown.
import { patchPages } from './listLogic.js';

const holdsAny = (data, idSet) => Boolean(data?.pages?.some((page) => page.articles.some((a) => idSet.has(a.id))));

/**
 * Applies `changes` to the articles with these ids in every cached list under
 * `queryKey`. Only lists holding one of them change, each keeping when it was
 * fetched and whether it was invalidated, so staleness works as before.
 */
export function patchCachedLists(queryClient, queryKey, ids, changes) {
  const idSet = new Set(ids);
  for (const query of queryClient.getQueryCache().findAll({ queryKey })) {
    const { data, dataUpdatedAt, isInvalidated } = query.state;
    if (!holdsAny(data, idSet)) continue;
    queryClient.setQueryData(query.queryKey, patchPages(data, idSet, changes), { updatedAt: dataUpdatedAt });
    if (isInvalidated) queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true, refetchType: 'none' });
  }
}
