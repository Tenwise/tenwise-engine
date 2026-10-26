import { useState } from 'react';

/**
 * Keeps tab state in step with one article field (e.g. aiSummary). During
 * render — so the next paint is already consistent — it calls:
 *   onArticleChange(value)  when a different article is shown
 *   onFieldChange(value)    when the same article's field changes
 *                           (background batch results landing)
 */
export function useArticleFieldSync(article, field, { onArticleChange, onFieldChange }) {
  const id = article?.id;
  const value = article?.[field];
  const [prev, setPrev] = useState({ id, value });
  if (prev.id !== id) {
    setPrev({ id, value });
    onArticleChange(value);
  } else if (prev.value !== value) {
    setPrev({ id, value });
    onFieldChange(value);
  }
}
