import { useCallback, useEffect, useState } from 'react';
import { fetchSummaries } from '../utils/api.js';
import { on } from '../lib/appEvents.js';

// Where the open article was last seen in the list, so that when it leaves
// the list (filed out of Unsorted, unsaved in Saved) j and k carry on from
// its place: the next article has moved up into it.
function useLastPosition(selected, found) {
  const [seen, setSeen] = useState({ id: null, index: -1 });
  const id = selected?.id ?? null;
  const moved = seen.id !== id || seen.index !== found;
  if (found >= 0 && moved) setSeen({ id, index: found });
  const left = found < 0 && seen.id === id;
  return left && id !== null ? seen.index : -1;
}

// Target index for a step: from the open article, or from where it was.
const stepFrom = (found, gonePlace, direction) => {
  if (found >= 0) return found + direction;
  return direction > 0 ? gonePlace : gonePlace - 1;
};

/** Previous/next navigation within the visible article list. */
export function useArticleNavigation(selected, setSelected, visible) {
  const found = selected ? visible.findIndex((a) => a.id === selected.id) : -1;
  const gonePlace = useLastPosition(selected, found);
  const index = found >= 0 ? found : gonePlace;
  const navigate = useCallback((direction) => {
    const next = index >= 0 && visible[stepFrom(found, gonePlace, direction)];
    if (next) setSelected(next);
  }, [index, found, gonePlace, visible, setSelected]);
  const hasPrev = stepFrom(found, gonePlace, -1) >= 0 && index >= 0;
  const hasNext = index >= 0 && stepFrom(found, gonePlace, 1) < visible.length;
  return { index, navigate, hasPrev, hasNext };
}

/** Saved-summaries count for the sidebar badge; refreshes on view change or save. */
export function useSummaryCount(viewType) {
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => {
    fetchSummaries().then((rows) => setCount(rows.length)).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [viewType, refresh]);
  return [count, refresh];
}

/**
 * Moving between the library screens and the reader: openFromLibrary(article)
 * reads it in All Articles; selectInView(id) selects an item in the open
 * screen. The 'open-view' event ({ type, id }) opens a view at an item, for
 * example a plugin's after it saves one.
 */
export function useLibraryNavigation(activeView, setActiveView, setSelectedArticle) {
  const openFromLibrary = useCallback((article) => {
    setActiveView({ type: 'all' });
    setSelectedArticle(article);
  }, [setActiveView, setSelectedArticle]);
  const selectInView = useCallback((id) => setActiveView({ type: activeView.type, id }), [activeView.type, setActiveView]);
  useEffect(() => on('open-view', ({ type, id }) => setActiveView({ type, id })), [setActiveView]);
  return { openFromLibrary, selectInView };
}
