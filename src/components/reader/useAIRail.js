import { useEffect } from 'react';
import { usePersistedToggle, usePersistedWidth } from '../../app/useLayout.js';
import { on } from '../../lib/appEvents.js';

/**
 * The AI side rail beside the article: open or closed, and its width. Both
 * are remembered, so the rail stays as you left it from article to article.
 * The command palette toggles it with the 'toggle-ai' app event.
 */
export function useAIRail() {
  const [open, toggle] = usePersistedToggle('tenwise-ai-rail-open', true);
  useEffect(() => on('toggle-ai', toggle), [toggle]); // from the command palette
  const [width, resize] = usePersistedWidth('tenwise-ai-rail-width', { fallback: 340, min: 280, max: 560, direction: -1 });
  return { open, toggle, width, resize };
}
