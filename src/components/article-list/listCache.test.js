import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { patchCachedLists } from './listCache.js';

const page = (...ids) => ({ pages: [{ articles: ids.map((id) => ({ id, isRead: 0 })), unread: ids.length }], pageParams: [0] });
const at = (client, view) => client.getQueryCache().find({ queryKey: ['articles', view], exact: true });

test('a collection an article was added to stays out of date after another list is patched (PR-21)', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
  client.setQueryData(['articles', 'collection:1'], page(), { updatedAt: Date.now() - 1000 });
  client.setQueryData(['articles', 'all'], page(7, 8), { updatedAt: Date.now() - 1000 });
  // Adding article 7 to the collection invalidates every list (useCollectionActions)…
  await client.invalidateQueries({ queryKey: ['articles'] });
  // …then opening it marks it read and saved everywhere it's listed.
  patchCachedLists(client, ['articles'], [7], { isRead: 1, savedAt: 'now' });
  assert.equal(at(client, 'collection:1').isStale(), true, 'still fetched again when opened');
  assert.equal(at(client, 'all').state.isInvalidated, true, 'the patched list stays invalidated too');
  assert.deepEqual(at(client, 'all').state.data.pages[0].articles[0], { id: 7, isRead: 1, savedAt: 'now' });
  assert.equal(at(client, 'all').state.data.pages[0].unread, 1);
});

test('a patch keeps when a fresh list was fetched, and leaves lists without the article alone', () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
  const fetched = Date.now() - 5000;
  client.setQueryData(['articles', 'all'], page(7), { updatedAt: fetched });
  const other = page(9);
  client.setQueryData(['articles', 'saved'], other, { updatedAt: fetched });
  patchCachedLists(client, ['articles'], [7], { isRead: 1 });
  assert.equal(at(client, 'all').state.dataUpdatedAt, fetched);
  assert.equal(at(client, 'all').isStale(), false);
  assert.equal(at(client, 'saved').state.data, other, 'untouched');
});
