import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { fetchArticlePage } from '../../utils/api.js';
import { flattenPages, patchPages } from './listLogic.js';

export const ARTICLES_KEY = 'articles';
const PAGE_SIZE = 150;
const NO_PAGES = { pages: [] };

const toSets = (facets = {}) => Object.fromEntries(Object.entries(facets).map(([k, values]) => [k, new Set(values)]));

// While a search or filter change loads, keep showing the previous results,
// but not across views (a new view shows the loading state).
const sameViewPlaceholder = (viewKey) => (previous, previousQuery) => (
  previousQuery?.queryKey[1] === viewKey ? previous : undefined
);

// Every cached list is refetched when refreshKey (a number) is bumped (a
// feed refresh, a batch result). The pages already loaded are fetched again,
// so the reader keeps their place.
function useRefetchOnRefresh(refreshKey, queryClient) {
  const mounted = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== mounted.current) queryClient.invalidateQueries({ queryKey: [ARTICLES_KEY] });
  }, [refreshKey, queryClient]);
}

/**
 * The active view's articles, a page at a time, narrowed on the server by
 * the search query and AI filters ({ q, filters, aiOnly }). Also returns the
 * view's counts and filter values, and calls to patch cached rows in place,
 * refetch, and load the next page.
 */
export function useArticleListData(activeView, refreshKey, feeds, { q, filters, aiOnly }) {
  const queryClient = useQueryClient();
  const viewKey = `${activeView.type}:${activeView.id}`;
  const query = useInfiniteQuery({
    queryKey: [ARTICLES_KEY, viewKey, { q, filters, aiOnly }],
    queryFn: ({ pageParam }) => fetchArticlePage(activeView.type, activeView.id, {
      q, filters, aiOnly, offset: pageParam, limit: PAGE_SIZE,
    }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    placeholderData: sameViewPlaceholder(viewKey),
  });
  useRefetchOnRefresh(refreshKey, queryClient);

  const { pages } = query.data ?? NO_PAGES;
  const articles = useMemo(() => flattenPages(pages), [pages]);
  const first = pages[0];
  const facets = useMemo(() => toSets(first?.facets), [first]);
  const feedMap = useMemo(() => Object.fromEntries(feeds.map((f) => [f.id, f])), [feeds]);

  // Optimistic update of several articles in every cached list (and its unread count).
  const updateLocal = useCallback((ids, changes) => {
    const idSet = new Set(ids);
    queryClient.setQueriesData({ queryKey: [ARTICLES_KEY] }, (data) => patchPages(data, idSet, changes));
  }, [queryClient]);

  const reload = useCallback(() => queryClient.invalidateQueries({ queryKey: [ARTICLES_KEY] }), [queryClient]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    articles,
    total: first?.total ?? 0,
    unread: first?.unread ?? 0,
    facets,
    loading: query.isPending,
    loadingMore: isFetchingNextPage,
    feedMap,
    updateLocal,
    reload,
    loadMore,
  };
}
