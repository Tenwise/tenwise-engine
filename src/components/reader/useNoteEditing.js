import { useCallback, useState } from 'react';
import { useOnKeyChange } from '../../hooks/useOnKeyChange.js';
import { emit } from '../../lib/appEvents.js';

// n (or the note button) saves the article if it isn't yet and asks for its
// note field. request counts the asks, so each refocuses it; each article
// starts at 0. collect (c) opens the collection picker for the article.
export function useNoteEditing(articleId, live) {
  const [request, setRequest] = useState(0);
  useOnKeyChange(articleId, () => setRequest(0));
  const { toggleBookmark } = live;
  const isSaved = Boolean(live.current?.isBookmarked);
  const edit = useCallback(() => {
    if (!isSaved) toggleBookmark();
    setRequest((n) => n + 1);
  }, [isSaved, toggleBookmark]);
  const collect = useCallback(() => { if (articleId) emit('open-collections', [articleId]); }, [articleId]);
  return { request, edit, collect };
}
