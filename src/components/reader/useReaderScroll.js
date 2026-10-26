import { useEffect, useRef, useState } from 'react';
import { useOnKeyChange } from '../../hooks/useOnKeyChange.js';
import { loadScrollPosition, saveScrollPosition } from './scrollMemory.js';

const SAVE_DELAY_MS = 400;

// Reading progress (0–100) of the scroll container.
function useReadingProgress(contentRef, articleId, isOpen) {
  const [progress, setProgress] = useState(0);
  useOnKeyChange(articleId, () => setProgress(0));

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      const total = el.scrollHeight - el.clientHeight;
      setProgress(total > 0 ? Math.min(100, (el.scrollTop / total) * 100) : 100);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [contentRef, isOpen, articleId]);

  return progress;
}

// Whether the saved position for this article should be applied now: once,
// after the content has settled.
const shouldRestore = (el, articleId, contentSettled, restoredId) =>
  Boolean(el && articleId && contentSettled) && restoredId !== articleId;

// Starts each article at the top, then restores its saved position once the
// content has settled, unless the reader already scrolled while it loaded.
// restoredRef holds the id of the article whose position has been restored.
function useRestoreScroll(contentRef, articleId, contentSettled, restoredRef) {
  useEffect(() => {
    const el = contentRef.current;
    if (el && articleId) el.scrollTop = 0;
    restoredRef.current = null;
  }, [contentRef, articleId, restoredRef]);

  useEffect(() => {
    const el = contentRef.current;
    if (!shouldRestore(el, articleId, contentSettled, restoredRef.current)) return;
    restoredRef.current = articleId;
    const saved = loadScrollPosition(articleId);
    if (saved > 0 && el.scrollTop === 0) el.scrollTop = saved;
  }, [contentRef, articleId, contentSettled, restoredRef]);
}

// Saves the position shortly after scrolling stops, and when leaving the
// article. Leaving saves the last position seen while reading: by the time
// this cleanup runs the next article is already in the DOM, and el.scrollTop
// no longer belongs to this one.
function useSaveScroll(contentRef, articleId, restoredRef) {
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !articleId) return undefined;
    let timer;
    let latest = null;
    const save = () => { if (latest !== null) saveScrollPosition(articleId, latest); };
    const onScroll = () => {
      if (restoredRef.current !== articleId) return; // not restored yet
      latest = el.scrollTop;
      clearTimeout(timer);
      timer = setTimeout(save, SAVE_DELAY_MS);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', onScroll);
      save();
    };
  }, [contentRef, articleId, restoredRef]);
}

/**
 * Reading progress (0–100) and per-article scroll position memory. The saved
 * position is restored only once `contentSettled` is true, because full-text
 * extraction can replace a short feed excerpt with a much longer article.
 */
export function useReaderScroll(contentRef, articleId, isOpen, contentSettled) {
  const restoredRef = useRef(null);
  useRestoreScroll(contentRef, articleId, contentSettled, restoredRef);
  useSaveScroll(contentRef, articleId, restoredRef);
  return useReadingProgress(contentRef, articleId, isOpen);
}
