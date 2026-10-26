import { useMemo } from 'react';
import { buildCommands } from '../components/shell/commands.js';
import { emit } from '../lib/appEvents.js';
import { useAppearance } from './AppearanceContext.jsx';
import { useLibrary } from './LibraryContext.jsx';

/** Command groups for the ⌘K palette, wired to the workspace. */
export function usePaletteCommands({ goToView, setModal, layout, readerOpen }) {
  const library = useLibrary();
  const { onToggleTheme } = useAppearance();
  return useMemo(() => {
    const groups = buildCommands({
      folders: library.folders,
      feeds: library.feeds,
      go: goToView,
      setViewMode: (mode) => emit('view-mode', mode),
      actions: {
        addFeed: () => setModal('addFeed'),
        openSettings: () => emit('open-settings'),
        refreshAll: library.onRefreshAll,
        toggleTheme: onToggleTheme,
        toggleSidebar: layout.toggleSidebarMode,
        toggleList: layout.toggleList,
        toggleAI: () => emit('toggle-ai'),
      },
    });
    // The AI rail belongs to the reader; offer it only with an article open.
    return readerOpen ? groups : groups.map((g) => ({ ...g, items: g.items.filter((i) => i.id !== 'ai-rail') }));
  }, [library.folders, library.feeds, library.onRefreshAll, goToView, setModal, onToggleTheme, layout.toggleSidebarMode, layout.toggleList, readerOpen]);
}
