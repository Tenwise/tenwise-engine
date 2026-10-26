import { useMemo } from 'react';
import { useAppearance } from '../app/AppearanceContext.jsx';
import { useLibrary } from '../app/LibraryContext.jsx';
import AppRail from './shell/AppRail.jsx';
import { ExpandedSidebar } from './sidebar/ExpandedSidebar.jsx';
import { groupFeeds, useSidebarCounts } from './sidebar/sidebarModel.js';

/** The app rail, plus the sidebar (views, folders, feeds) unless it's hidden. */
export default function Sidebar({ mode = 'expanded', activeView, onViewChange, onAddFeed, onSettings, onToggleMode, librarySummaryCount = 0, style }) {
  const library = useLibrary();
  const { theme, onToggleTheme } = useAppearance();
  const counts = useSidebarCounts(library.countsRefreshKey, librarySummaryCount);
  const grouped = useMemo(() => groupFeeds(library.feeds), [library.feeds]);
  const open = mode !== 'hidden';
  const actions = { ...library, theme, onToggleTheme, onAddFeed, onSettings, onToggleMode, onToggleSidebar: onToggleMode, sidebarOpen: open };
  return (
    <>
      <AppRail activeView={activeView} onViewChange={onViewChange} counts={counts} actions={actions} />
      {open && <ExpandedSidebar style={style} activeView={activeView} onViewChange={onViewChange} counts={counts} folders={library.folders} feeds={library.feeds} grouped={grouped} actions={actions} />}
    </>
  );
}
