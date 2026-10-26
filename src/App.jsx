import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import ArticleList from './components/ArticleList.jsx';
import ArticleReader from './components/ArticleReader.jsx';
import ReaderErrorBoundary from './components/reader/ReaderErrorBoundary.jsx';
import ReaderPlaceholder from './components/shell/ReaderPlaceholder.jsx';
import ResizableHandle from './components/shell/ResizableHandle.jsx';
import ServerBanner from './components/shell/ServerBanner.jsx';
import Sidebar from './components/Sidebar.jsx';
import { AppearanceProvider } from './app/AppearanceContext.jsx';
import { LibraryProvider, useLibrary } from './app/LibraryContext.jsx';
import { ToastProvider } from './app/ToastContext.jsx';
import { useLayout } from './app/useLayout.js';
import { usePaneKeyboard } from './app/usePaneKeyboard.js';
import { emit, on } from './lib/appEvents.js';
import { useSettingsModal } from './app/useSettingsModal.js';
import { useCommandPalette } from './app/useCommandPalette.js';
import { usePaletteCommands } from './app/usePaletteCommands.js';
import { useArticleNavigation, useLibraryNavigation, useSummaryCount } from './app/useWorkspace.js';
import { useAvailableModels } from './hooks/useAvailableModels.js';
import { pluginsOf } from './plugins/index.js';

// Screens opened now and then load on first use, keeping the startup bundle
// small (the list, the reader and the AI rail are in it).
const AddFeedDialog = lazy(() => import('./components/add-feed/AddFeedDialog.jsx'));
const CollectionPicker = lazy(() => import('./components/library/CollectionPicker.jsx'));
const CommandPalette = lazy(() => import('./components/shell/CommandPalette.jsx'));
const HighlightsScreen = lazy(() => import('./components/library/HighlightsScreen.jsx'));
const SettingsScreen = lazy(() => import('./components/settings/SettingsScreen.jsx'));
const SummariesScreen = lazy(() => import('./components/library/SummariesScreen.jsx'));
// Screens of plugin views (src/plugins/index.js), such as Studio, by view type.
const PLUGIN_VIEWS = Object.fromEntries(pluginsOf('views').map(({ type, Screen }) => [type, Screen]));
const LIBRARY_VIEWS = { library: SummariesScreen, highlights: HighlightsScreen, ...PLUGIN_VIEWS };
// Panels of plugin operations on selected articles, such as Compare, by operation id.
const OPERATION_PANELS = Object.fromEntries(pluginsOf('selectionOperations').map(({ id, Panel }) => [id, Panel]));
// The palette searches all articles while a library screen is open.
const ALL_ARTICLES = { type: 'all' };

// Mounts lazy children only once they have been opened, then keeps them
// mounted (so dialogs keep their state and close animations).
function OnceOpened({ open, children }) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened ? <Suspense fallback={null}>{children}</Suspense> : null;
}

// Right-hand panel: a plugin's panel for selected articles, the reader, or nothing.
function DetailPanel({ multiPanel, onCloseMulti, reader, layout }) {
  if (multiPanel) {
    const Panel = OPERATION_PANELS[multiPanel.operation];
    return (
      <Suspense fallback={<ReaderPlaceholder width={layout.readerWidth} onResize={layout.resizeReader} />}>
        <Panel articles={multiPanel.articles} initialOperation={multiPanel.operation} onClose={onCloseMulti} width={layout.readerWidth} onResize={layout.resizeReader} />
      </Suspense>
    );
  }
  if (!reader.article) return <ReaderPlaceholder width={layout.readerWidth} onResize={layout.resizeReader} />;
  return (
    <ReaderErrorBoundary width={layout.readerWidth} onClose={reader.onClose}>
      <ArticleReader {...reader} isOpen width={layout.readerWidth} onResize={layout.resizeReader} />
    </ReaderErrorBoundary>
  );
}

// The page's one main landmark: everything right of the sidebar. A library
// screen (Summaries, Highlights, a plugin's) when one is open, else the children
// (the list and the reader). edge: the sidebar's resize handle, which sits
// on main's leading edge so that it, too, is inside a landmark.
function MainArea({ edge, library, children }) {
  return (
    <main className="flex min-w-0 flex-1">
      {edge}
      {library ? <Suspense fallback={<div className="flex-1" />}>{library}</Suspense> : children}
    </main>
  );
}

// The ⌘K palette with the workspace's commands and the current list's articles.
function PaletteHost({ open, onOpenChange, view, onOpenArticle, commands }) {
  const { sourceFeeds } = useLibrary();
  const groups = usePaletteCommands(commands);
  const sourceOf = useCallback((article) => sourceFeeds.find((f) => f.id === article.feedId)?.title || '', [sourceFeeds]);
  return <CommandPalette open={open} onOpenChange={onOpenChange} groups={groups} view={view} sourceOf={sourceOf} onOpenArticle={onOpenArticle} />;
}

// The collection picker, opened by the 'open-collections' event with the
// article ids to file (c in the reader, Collect on a selection).
function useCollectionPicker() {
  const [articleIds, setArticleIds] = useState(null);
  useEffect(() => on('open-collections', (ids) => { if (ids?.length) setArticleIds(ids); }), []);
  const close = useCallback(() => setArticleIds(null), []);
  return { open: articleIds !== null, articleIds, close };
}

function CollectionPickerHost({ picker }) {
  return (
    <OnceOpened open={picker.open}>
      <CollectionPicker key={picker.articleIds?.join(',')} open={picker.open} articleIds={picker.articleIds ?? []} onClose={picker.close} />
    </OnceOpened>
  );
}

// Dialogs over the workspace: Add Feed or Settings (modal), the collection
// picker, and whether any of them or the palette is open (single-key
// shortcuts pause while one is).
function useOverlays(paletteOpen) {
  const [modal, setModal] = useState(null); // 'addFeed' | 'settings' | null
  const closeModal = useCallback(() => setModal(null), []);
  const settingsSection = useSettingsModal(setModal);
  const picker = useCollectionPicker();
  const anyOpen = [modal !== null, paletteOpen, picker.open].some(Boolean);
  return { modal, setModal, closeModal, settingsSection, picker, anyOpen };
}

function Workspace({ activeView, setActiveView, selectedArticle, setSelectedArticle }) {
  const library = useLibrary();
  const layout = useLayout();
  const availableModels = useAvailableModels();
  const [visibleArticles, setVisibleArticles] = useState([]);
  const [multiPanel, setMultiPanel] = useState(null); // { articles, operation }
  const [summaryCount, refreshSummaryCount] = useSummaryCount(activeView.type);
  const [changedArticle, setChangedArticle] = useState(null);
  const onArticleChanged = useCallback((updated) => { library.bumpCounts(); setChangedArticle(updated); }, [library]);
  const onLibraryChanged = useCallback(() => { refreshSummaryCount(); library.bumpCounts(); }, [refreshSummaryCount, library]);
  const nav = useArticleNavigation(selectedArticle, setSelectedArticle, visibleArticles);
  const [paletteOpen, setPaletteOpen] = useCommandPalette();
  const { modal, setModal, closeModal, settingsSection, picker, anyOpen: overlayOpen } = useOverlays(paletteOpen);
  usePaneKeyboard({ isModalOpen: overlayOpen, toggleSidebar: layout.toggleSidebarMode, toggleList: layout.toggleList });
  const goToView = useCallback((view) => { setActiveView(view); setSelectedArticle(null); }, [setActiveView, setSelectedArticle]);

  const closeReader = useCallback(() => setSelectedArticle(null), [setSelectedArticle]);
  const { openFromLibrary, selectInView } = useLibraryNavigation(activeView, setActiveView, setSelectedArticle);
  const LibraryScreen = LIBRARY_VIEWS[activeView.type];

  return (
    <div className={layout.listHidden ? 'app-layout list-hidden' : 'app-layout'}>
      <Sidebar
        mode={layout.sidebarMode}
        activeView={activeView}
        onViewChange={goToView}
        onAddFeed={() => setModal('addFeed')} onSettings={() => emit('open-settings')} onToggleMode={layout.toggleSidebarMode}
        librarySummaryCount={summaryCount}
        style={{ width: layout.effectiveSidebarWidth, minWidth: layout.effectiveSidebarWidth }}
      />
      <MainArea
        edge={layout.sidebarMode === 'expanded' && <ResizableHandle onResize={layout.resizeSidebar} />}
        library={LibraryScreen && <LibraryScreen onOpenArticle={openFromLibrary} onChanged={onLibraryChanged} selectedId={activeView.id} onSelect={selectInView} />}
      >
        <ArticleList
          activeView={activeView}
          selectedArticleId={selectedArticle?.id}
          onSelectArticle={setSelectedArticle}
          onArticlesLoaded={setVisibleArticles}
          onOpenAIPanel={(articles, operation) => { setMultiPanel({ articles, operation }); setSelectedArticle(null); }}
          refreshKey={library.articlesRefreshKey}
          onCountChanged={library.bumpCounts}
          changedArticle={changedArticle}
        />
        <DetailPanel
          multiPanel={multiPanel}
          onCloseMulti={() => setMultiPanel(null)}
          layout={layout}
          reader={{
            article: selectedArticle, isModalOpen: overlayOpen, onClose: closeReader, onArticleChanged,
            onNavigate: nav.navigate, hasPrev: nav.hasPrev, hasNext: nav.hasNext, currentIndex: nav.index,
            totalCount: visibleArticles.length, onSummarySaved: refreshSummaryCount,
          }}
        />
      </MainArea>

      <OnceOpened open={paletteOpen}><PaletteHost
        open={paletteOpen} onOpenChange={setPaletteOpen} view={LibraryScreen ? ALL_ARTICLES : activeView}
        onOpenArticle={LibraryScreen ? openFromLibrary : setSelectedArticle}
        commands={{ goToView, setModal, layout, readerOpen: Boolean(selectedArticle) }}
      /></OnceOpened>
      <CollectionPickerHost picker={picker} />
      <OnceOpened open={modal === 'addFeed'}><AddFeedDialog isOpen={modal === 'addFeed'} onClose={closeModal} /></OnceOpened>
      <OnceOpened open={modal === 'settings'}>
        <SettingsScreen key={settingsSection ?? 'start'} section={settingsSection} isOpen={modal === 'settings'} onClose={closeModal} availableModels={availableModels} />
      </OnceOpened>
    </div>
  );
}

// Providers plugins add around the workspace (src/plugins/index.js), such as
// background AI processing, which runs whatever is on screen.
const PLUGIN_PROVIDERS = pluginsOf('providers');
const PluginProviders = ({ children }) => PLUGIN_PROVIDERS.reduceRight((inner, { id, Provider }) => <Provider key={id}>{inner}</Provider>, children);

// View and selection state lives above the library provider so that deleting
// the current feed or folder can return the app to All Articles.
function AppShell() {
  const [activeView, setActiveView] = useState({ type: 'all' });
  const [selectedArticle, setSelectedArticle] = useState(null);
  // (type, id) leaves that feed or folder view; (null) leaves any of them.
  const onViewRemoved = useCallback((type, id) => {
    setActiveView((view) => (type === null || (view.type === type && view.id === id) ? { type: 'all' } : view));
  }, []);
  return (
    <LibraryProvider onViewRemoved={onViewRemoved}>
      <PluginProviders>
        <Workspace activeView={activeView} setActiveView={setActiveView} selectedArticle={selectedArticle} setSelectedArticle={setSelectedArticle} />
      </PluginProviders>
    </LibraryProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppearanceProvider>
        <AppShell />
        <ServerBanner />
      </AppearanceProvider>
    </ToastProvider>
  );
}
