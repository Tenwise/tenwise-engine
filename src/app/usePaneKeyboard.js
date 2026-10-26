import { useEffect } from 'react';
import { isShortcut } from '../hooks/keys.js';

/** Pane shortcuts: [ cycles the sidebar, ] hides or shows the article list. Off while a modal is open. */
export function usePaneKeyboard({ isModalOpen, toggleSidebar, toggleList }) {
  useEffect(() => {
    const keys = { '[': toggleSidebar, ']': toggleList };
    const onKeyDown = (e) => {
      const action = keys[e.key];
      if (!action) return;
      if (isModalOpen || !isShortcut(e)) return;
      e.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen, toggleSidebar, toggleList]);
}
