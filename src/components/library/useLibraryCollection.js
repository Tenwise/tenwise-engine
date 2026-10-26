import { useCallback, useEffect, useMemo, useState } from 'react';
import { safeHttpUrl } from '../../utils/opml.js';
import { fetchArticleByLink } from '../../utils/api.js';
import { filterRows } from './libraryModel.js';

/**
 * A saved collection (summaries, highlights): load with retry, the SQLite
 * file path, search across `searchFields`, and delete.
 */
export function useLibraryCollection({ fetchRows, fetchDbPath, deleteRow, searchFields, onChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dbPath, setDbPath] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(() => fetchRows()
    .then((data) => { setRows(data); setError(null); })
    .catch((err) => setError(err.message))
    .finally(() => setLoading(false)), [fetchRows]);

  useEffect(() => {
    load();
    fetchDbPath().then(({ path }) => setDbPath(path)).catch(() => {});
  }, [load, fetchDbPath]);

  const retry = useCallback(() => { setLoading(true); setError(null); load(); }, [load]);
  const remove = useCallback(async (id) => {
    await deleteRow(id);
    setRows((prev) => prev.filter((r) => r.id !== id));
    onChanged?.();
  }, [deleteRow, onChanged]);
  const filtered = useMemo(() => filterRows(rows, search, searchFields), [rows, search, searchFields]);

  return { rows, filtered, loading, error, dbPath, search, setSearch, retry, remove };
}

/** Opens a saved article's URL in the reader if it's in the library, else in a new tab. */
export function useOpenInReader(onOpenArticle) {
  return useCallback(async (articleUrl) => {
    if (!articleUrl) return;
    const article = await fetchArticleByLink(articleUrl).catch(() => null);
    if (article && onOpenArticle) onOpenArticle(article);
    else if (safeHttpUrl(articleUrl)) window.open(safeHttpUrl(articleUrl), '_blank', 'noopener,noreferrer');
  }, [onOpenArticle]);
}
