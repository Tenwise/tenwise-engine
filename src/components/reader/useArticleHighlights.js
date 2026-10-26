import { useCallback, useEffect, useState } from 'react';
import * as api from '../../utils/api.js';
import { useOnKeyChange } from '../../hooks/useOnKeyChange.js';
import { HIGHLIGHT_COLORS } from '../../utils/constants.js';
import { locateAcrossSegments } from '../highlights/textLocator.js';

function clearMarks(container) {
  container.querySelectorAll('mark[data-highlight-id]').forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize();
  });
}

function createMark(h, text) {
  const mark = document.createElement('mark');
  mark.setAttribute('data-highlight-id', String(h.id));
  mark.style.background = HIGHLIGHT_COLORS[h.color] || HIGHLIGHT_COLORS.yellow;
  mark.style.borderRadius = '2px';
  if (h.note) mark.title = h.note;
  mark.textContent = text;
  return mark;
}

function textNodes(container) {
  const nodes = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
  return nodes;
}

// Replaces node's text between start and end with a <mark>.
function wrapRange(node, start, end, h) {
  const value = node.nodeValue;
  const frag = document.createDocumentFragment();
  if (start > 0) frag.appendChild(document.createTextNode(value.slice(0, start)));
  frag.appendChild(createMark(h, value.slice(start, end)));
  if (end < value.length) frag.appendChild(document.createTextNode(value.slice(end)));
  node.parentNode.replaceChild(frag, node);
}

// Marks the first occurrence of the highlight's text, which may span several
// text nodes (across links, emphasis or paragraphs): one <mark> per node.
function markFirstOccurrence(container, h) {
  const nodes = textNodes(container);
  const ranges = locateAcrossSegments(nodes.map((n) => n.nodeValue), h.highlighted_text);
  for (const { segment, start, end } of ranges) wrapRange(nodes[segment], start, end, h);
}

/** Draws saved highlights onto the rendered article DOM. */
export function applyHighlights(container, highlights) {
  clearMarks(container);
  for (const h of highlights) markFirstOccurrence(container, h);
}

/** Saved highlights for the open article, keyed by its URL. */
export function useArticleHighlights(articleId, link) {
  const [highlights, setHighlights] = useState([]);
  useOnKeyChange(articleId, () => setHighlights([]));

  const reload = useCallback(() => {
    if (!link) return;
    api.fetchHighlightsByArticle(link).then(setHighlights).catch(() => setHighlights([]));
  }, [link]);

  useEffect(() => { reload(); }, [reload]);

  const remove = useCallback(async (id) => {
    await api.deleteHighlight(id);
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  }, []);

  return { highlights, reload, remove };
}
