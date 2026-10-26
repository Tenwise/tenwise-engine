import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLibrary } from '../../app/LibraryContext.jsx';
import { useToast } from '../../app/ToastContext.jsx';
import { emit } from '../../lib/appEvents.js';
import { COLLECTIONS_QUERY_KEY } from '../../lib/queryClient.js';
import * as api from '../../utils/api.js';
import { ARTICLES_KEY } from '../article-list/useArticleListData.js';

const NONE = [];

/** Every collection, by name, with its article count. */
export function useCollections() {
  const query = useQuery({ queryKey: [COLLECTIONS_QUERY_KEY], queryFn: api.fetchCollections });
  return query.data ?? NONE;
}

/** Ids of the collections an article is in (empty while loading or with no article). */
export function useArticleCollections(articleId) {
  const query = useQuery({
    queryKey: [COLLECTIONS_QUERY_KEY, 'of', articleId],
    queryFn: () => api.fetchArticleCollections(articleId),
    enabled: Boolean(articleId),
  });
  return query.data ?? NONE;
}

/**
 * Changes to collections. Each refreshes the collections (and memberships),
 * the article lists (adding saves articles), and the sidebar counts; a
 * failure shows a toast and resolves to null.
 */
export function useCollectionActions() {
  const queryClient = useQueryClient();
  const { bumpCounts } = useLibrary();
  const showToast = useToast();
  return useMemo(() => {
    const run = (call) => async (...args) => {
      try {
        return await call(...args);
      } catch (err) {
        showToast(err.message, 'error');
        return null;
      } finally {
        queryClient.invalidateQueries({ queryKey: [COLLECTIONS_QUERY_KEY] });
        queryClient.invalidateQueries({ queryKey: [ARTICLES_KEY] });
        bumpCounts();
      }
    };
    return {
      create: run((name) => api.createCollection({ name })),
      rename: run((id, name) => api.updateCollection(id, { name })),
      remove: run((id) => api.deleteCollection(id)),
      add: run(async (id, articleIds) => {
        const collection = await api.addToCollection(id, articleIds);
        emit('articles-changed', articleIds); // adding saves them; an open reader refreshes
        return collection;
      }),
      take: run((id, articleIds) => api.removeFromCollection(id, articleIds)),
    };
  }, [queryClient, bumpCounts, showToast]);
}
