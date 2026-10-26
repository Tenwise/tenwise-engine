import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../../utils/api.js';
import { useOnKeyChange } from '../../hooks/useOnKeyChange.js';
import { on } from '../../lib/appEvents.js';

const flip = (flag) => (flag ? 0 : 1);

// The article as stored on the server, reloaded when the article changes.
// Responses for an article that is no longer open are ignored (fast j/k can
// reorder them), so one article's copy never lands on another.
function useServerCopy(articleId) {
  const [live, setLiveRaw] = useState(null);
  const openIdRef = useRef(articleId);
  useEffect(() => { openIdRef.current = articleId; }, [articleId]);
  useOnKeyChange(articleId, () => setLiveRaw(null));
  const setLive = useCallback((copy) => {
    if (copy?.id === openIdRef.current) setLiveRaw(copy);
  }, []);
  useEffect(() => {
    if (!articleId) return;
    api.fetchArticle(articleId).then(setLive).catch(() => {});
  }, [articleId, setLive]);
  return [live, setLive];
}

// Marks the article read when opened. The ref guards against re-patching the
// same article when the parent re-renders with a stale isRead flag.
function useMarkReadOnOpen(article, setLive, notify) {
  const markedReadRef = useRef(null);
  useEffect(() => {
    if (!article || article.isRead) return;
    if (markedReadRef.current === article.id) return;
    markedReadRef.current = article.id;
    api.patchArticle(article.id, { isRead: 1 })
      .then((updated) => { setLive(updated); notify(updated); })
      .catch(() => {});
  }, [article, setLive, notify]);
}

// Changed elsewhere (filed in a collection, which saves it): reload the server copy.
function useReloadWhenChanged(articleId, setLive, notify) {
  useEffect(() => on('articles-changed', (ids) => {
    if (!ids?.includes(articleId)) return;
    api.fetchArticle(articleId).then((updated) => { setLive(updated); notify(updated); }).catch(() => {});
  }), [articleId, setLive, notify]);
}

/**
 * The open article as stored on the server (full content, latest read and
 * save state and note), plus actions that update it. Marks the article read on open.
 */
export function useLiveArticle(article, onArticleChanged) {
  const articleId = article?.id;
  const [live, setLive] = useServerCopy(articleId);
  const notify = useCallback((updated) => onArticleChanged?.(updated), [onArticleChanged]);
  useMarkReadOnOpen(article, setLive, notify);
  useReloadWhenChanged(articleId, setLive, notify);
  const current = live || article;

  const patch = useCallback(async (changes) => {
    if (!articleId) return;
    const updated = await api.patchArticle(articleId, changes);
    setLive(updated);
    notify(updated);
  }, [articleId, setLive, notify]);

  const toggleBookmark = useCallback(() => patch({ isBookmarked: flip(current?.isBookmarked) }), [patch, current]);
  const toggleRead = useCallback(() => patch({ isRead: flip(current?.isRead) }), [patch, current]);
  // By id, since the note can finish saving after the reader has moved on.
  const saveNote = useCallback(async (id, note) => {
    const updated = await api.patchArticle(id, { note });
    setLive(updated);
    notify(updated);
  }, [setLive, notify]);

  return { current, toggleBookmark, toggleRead, saveNote };
}
