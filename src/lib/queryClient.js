import { QueryClient } from '@tanstack/react-query';

// Server data is refetched when the app says it changed (a feed refresh, a
// batch result), not on window focus: the data lives on this machine.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

/** Query keys shared by more than one feature. */
export const COLLECTIONS_QUERY_KEY = 'collections';
