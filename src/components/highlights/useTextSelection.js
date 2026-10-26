import { useEffect, useState } from 'react';
import { toolbarPosition } from './toolbarPosition.js';

// The window's selection if it covers some text, else null.
function activeSelection() {
  const selection = window.getSelection();
  const hasRange = selection?.rangeCount > 0 && !selection.isCollapsed;
  return hasRange ? selection : null;
}

// The current selection inside the article body, or null.
function selectionInArticle(container) {
  const selection = activeSelection();
  if (!selection) return null;
  const text = selection.toString().trim();
  const content = container?.querySelector('.reader-article-content');
  if (!text || !content) return null;
  const range = selection.getRangeAt(0);
  if (!content.contains(range.commonAncestorContainer)) return null;
  return { text, ...toolbarPosition(range.getBoundingClientRect(), container.getBoundingClientRect()) };
}

/**
 * Tracks text selected in the article: { text, top, left } after mouseup,
 * cleared on mousedown elsewhere or Escape. Clicks inside toolbarRef are ignored.
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
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [containerRef, toolbarRef, onNewSelection]);

  return [sel, setSel];
}
