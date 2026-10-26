import { useCallback, useState } from 'react';
import { useOnKeyChange } from '../../hooks/useOnKeyChange.js';

/** Multi-selection of article ids; cleared when the view changes. */
export function useSelection(viewKey) {
  const [ids, setIds] = useState(() => new Set());
  useOnKeyChange(viewKey, () => setIds(new Set()));

  const toggle = useCallback((id) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clear = useCallback(() => setIds(new Set()), []);
  const selectAll = useCallback((articles) => setIds(new Set(articles.map((a) => a.id))), []);

  return { ids, size: ids.size, has: (id) => ids.has(id), toggle, clear, selectAll };
}
