import { useCallback, useEffect, useState } from 'react';
import { isPhone, usePersistedToggle, usePersistedWidth } from '../../app/useLayout.js';
import { on } from '../../lib/appEvents.js';

/**
 * The AI side rail beside the article: open or closed, and its width. Both
 * are remembered, so the rail stays as you left it from article to article.
 * The command palette toggles it with the 'toggle-ai' app event. On a phone
 * it covers the article, so there it starts closed every time and isn't
 * remembered (CON-4): a computer keeps its own choice.
 */
export function useAIRail() {
  const [stored, toggleStored] = usePersistedToggle('tenwise-ai-rail-open', true);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const togglePhone = useCallback(() => setPhoneOpen((v) => !v), []);
  const phone = isPhone();
  const open = phone ? phoneOpen : stored;
  const toggle = phone ? togglePhone : toggleStored;
  useEffect(() => on('toggle-ai', toggle), [toggle]); // from the command palette
  const [width, resize] = usePersistedWidth('tenwise-ai-rail-width', { fallback: 340, min: 280, max: 560, direction: -1 });
  return { open, toggle, width, resize };
}
