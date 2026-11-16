import { useEffect, useState } from 'react';
import { toolbarPosition } from './toolbarPosition.js';

// The window's selection if it covers some text, else null.
function activeSelection() {
  const selection = window.getSelection();
  const hasRange = selection?.rangeCount > 0 && !selection.isCollapsed;
  return hasRange ? selection : null;
}

// A phone or tablet: text is selected by long-press, which sends no mouseup.
const isTouch = () => Boolean(window.matchMedia?.('(pointer: coarse)').matches);
// How long a touch selection must hold still before the toolbar shows (handles move it).
const TOUCH_SETTLE_MS = 400;

// The current selection inside the article body, or null.
function selectionInArticle(container, touch = false) {
  const selection = activeSelection();
  if (!selection) return null;
  const text = selection.toString().trim();
  const content = container?.querySelector('.reader-article-content');
  if (!text || !content) return null;
  const range = selection.getRangeAt(0);
  if (!content.contains(range.commonAncestorContainer)) return null;
  return { text, ...toolbarPosition(range.getBoundingClientRect(), container.getBoundingClientRect(), { touch }) };
}

/**
 * Tracks text selected in the article: { text, top, left } after mouseup,
 * cleared on mousedown elsewhere or Escape. Clicks inside toolbarRef are ignored.
 * On a touch screen, where long-press selection sends no mouseup, it follows
 * the selection itself once it has settled (CON-4).
 */
export function useTextSelection(containerRef, toolbarRef, onNewSelection) {
  const [sel, setSel] = useState(null);

  useEffect(() => {
    const inToolbar = (e) => toolbarRef.current?.contains(e.target);
    const onMouseDown = (e) => { if (!inToolbar(e)) setSel(null); };
    const onMouseUp = (e) => {
      if (inToolbar(e)) return;
      const next = selectionInArticle(containerRef.current);
      if (!next) return;
      setSel(next);
      onNewSelection();
    };
    const onKeyDown = (e) => { if (e.key === 'Escape') setSel(null); };
    let settle = null;
    const onSelectionChange = () => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        const next = selectionInArticle(containerRef.current, true);
        setSel(next);
        if (next) onNewSelection();
      }, TOUCH_SETTLE_MS);
    };
    const touch = isTouch();
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
    if (touch) document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      clearTimeout(settle);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKeyDown);
      if (touch) document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [containerRef, toolbarRef, onNewSelection]);

  return [sel, setSel];
}
