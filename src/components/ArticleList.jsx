import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bulkUpdateArticles, markViewRead } from '../utils/api.js';
import { readStored, writeStored } from '../utils/storage.js';
import { useLibrary } from '../app/LibraryContext.jsx';
import { useServerDown } from '../app/useServerDown.js';
import { useToast } from '../app/ToastContext.jsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { EmptyList, LoadingCards } from './article-list/ArticleCards.jsx';
import { FilterBar } from './article-list/FilterBar.jsx';
import { ListHeader, SearchBar } from './article-list/ListHeader.jsx';
import { SelectionBar } from './article-list/SelectionBar.jsx';
import { articlesToCSV, downloadCSV, emptyStateText, groupingFor, isSaveList, viewTitle } from './article-list/listLogic.js';
import { useArticleListData } from './article-list/useArticleListData.js';
import CollectionOutBar from './library/CollectionOutBar.jsx';
import { useCollections } from './library/useCollections.js';
import { useConfirmAction } from '../hooks/useConfirmAction.js';
import { useListKeyboard } from './article-list/useListKeyboard.js';
import { useSelection } from './article-list/useSelection.js';
import { VirtualArticleList } from './article-list/VirtualArticleList.jsx';
import ListKeyHints from './shell/ListKeyHints.jsx';
import { emit, on } from '../lib/appEvents.js';
import { cn } from '../lib/utils.js';

const VIEW_MODE_KEY = 'tenwise-view-mode';
const SEARCH_DEBOUNCE_MS = 250;
// Padding of the scroll container per view mode (rows and cards carry their own sides).
const CONTENT_PADDING = { magazine: 'px-3.5 pt-3.5 pb-5', rows: 'pt-1 pb-3' };

function useViewMode() {
  const [viewMode, setViewMode] = useState(() => readStored(VIEW_MODE_KEY, 'rows'));
  const change = useCallback((mode) => {
    setViewMode(mode);
    writeStored(VIEW_MODE_KEY, mode);
  }, []);
  useEffect(() => on('view-mode', change), [change]); // from the command palette
  return [viewMode, change];
}

// Search bar state. The input ref is returned separately so the state object
// stays a plain value that render code can read.
function useSearchState() {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const focusInput = useCallback(() => setTimeout(() => inputRef.current?.focus(), 0), []);
  const search = useMemo(() => ({
    visible, query, setQuery,
    open: () => { setVisible(true); focusInput(); },
    close: () => { setVisible(false); setQuery(''); },
    toggle: () => { if (visible) setQuery(''); setVisible(!visible); },
  }), [visible, query, focusInput]);
  return [search, inputRef];
}

// Tells the parent which articles are visible (for reader navigation), debounced.
function useNotifyVisible(articles, onArticlesLoaded) {
  useEffect(() => {
    const timer = setTimeout(() => onArticlesLoaded?.(articles), 150);
    return () => clearTimeout(timer);
  }, [articles, onArticlesLoaded]);
}

// A new search or filter starts the results at the top.
function useScrollTopOnQuery(scrollRef, query) {
  const key = JSON.stringify(query);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [scrollRef, key]);
}

// The view's current name (a feed, folder or collection may have been renamed since it was opened).
function useLiveViewTitle(activeView) {
  const { feeds, folders } = useLibrary();
  const collections = useCollections();
  const sources = { feed: feeds, folder: folders, collection: collections };
  const item = (sources[activeView.type] ?? []).find((x) => x.id === activeView.id);
  return viewTitle({ ...activeView, name: item?.title ?? item?.name ?? activeView.name });
}

// Applies read, save and note changes made in the reader to the matching row.
function useReaderChanges(changedArticle, updateLocal) {
  useEffect(() => {
    if (changedArticle) {
      const { isRead, isBookmarked, savedAt, note } = changedArticle;
      updateLocal([changedArticle.id], { isRead, isBookmarked, savedAt, note });
    }
  }, [changedArticle, updateLocal]);
}

// Bulk actions on the selection and on the whole view.
function useListActions({ data, activeView, selection, visible, sourceOf, onCountChanged, onOpenAIPanel }) {
  const selected = useCallback(() => visible.filter((a) => selection.has(a.id)), [visible, selection]);

  const showToast = useToast();
  // Optimistic: shown at once; on failure the list is refetched from the server.
  const commit = useCallback(async (apply, save) => {
    apply();
    try {
      await save();
      onCountChanged?.();
    } catch (err) {
      showToast(`Couldn't update articles: ${err.message}`, 'error');
      data.reload();
    }
  }, [data, onCountChanged, showToast]);

  const update = useCallback((ids, changes) => (ids.length === 0 ? undefined : commit(
    () => data.updateLocal(ids, changes),
    () => bulkUpdateArticles(ids, changes),
  )), [data, commit]);

  // Every unread article in the view, loaded or not; the counts come back from the server.
  const markAllRead = useCallback(() => commit(
    () => data.updateLocal(data.articles.filter((a) => !a.isRead).map((a) => a.id), { isRead: 1 }),
    async () => { await markViewRead(activeView.type, activeView.id); data.reload(); },
  ), [data, commit, activeView.type, activeView.id]);

  return useMemo(() => ({
    clear: selection.clear,
    selectAll: () => selection.selectAll(visible),
    markRead: async () => { await update([...selection.ids], { isRead: 1 }); selection.clear(); },
    bookmark: async () => { await update([...selection.ids], { isBookmarked: 1 }); selection.clear(); },
    collect: () => emit('open-collections', [...selection.ids]),
    exportCSV: () => { downloadCSV(articlesToCSV(selected(), sourceOf), 'tenwise-articles.csv'); selection.clear(); },
    openAIPanel: (operation) => onOpenAIPanel?.(selected().map((a) => ({ ...a, feedTitle: sourceOf(a) || 'Unknown' })), operation),
    markAllRead,
  }), [selection, visible, update, selected, sourceOf, onOpenAIPanel, markAllRead]);
}

function ListContent({ loading, articles, empty, ...listProps }) {
  if (loading) return <LoadingCards />;
  if (articles.length === 0) return <EmptyList {...empty} />;
  return <VirtualArticleList articles={articles} {...listProps} />;
}

export default function ArticleList({
  activeView, selectedArticleId, onSelectArticle, onArticlesLoaded,
  onOpenAIPanel, refreshKey = 0, onCountChanged, changedArticle,
}) {
  const library = useLibrary();
  const [search, searchInputRef] = useSearchState();
  const [activeFilters, setActiveFilters] = useState({});
  const [aiOnly, setAiOnly] = useState(false);
  const q = useDebouncedValue(search.query.trim(), SEARCH_DEBOUNCE_MS);
  const data = useArticleListData(activeView, refreshKey, library.sourceFeeds, { q, filters: activeFilters, aiOnly });
  useReaderChanges(changedArticle, data.updateLocal);
  const title = useLiveViewTitle(activeView);
  const [viewMode, setViewMode] = useViewMode();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const selection = useSelection(`${activeView.type}:${activeView.id}`);
  const scrollRef = useRef(null);
  useScrollTopOnQuery(scrollRef, { q, activeFilters, aiOnly });

  const sourceOf = useCallback((article) => data.feedMap[article.feedId]?.title, [data.feedMap]);
  const visible = data.articles;
  useNotifyVisible(visible, onArticlesLoaded);
  useListKeyboard({ search, selection });

  const actions = useListActions({ data, activeView, selection, visible, sourceOf, onCountChanged, onOpenAIPanel });
  const markAllRead = useConfirmAction(actions.markAllRead);
  const unreadCount = data.unread;
  const activeCount = Object.values(activeFilters).filter(Boolean).length + (aiOnly ? 1 : 0);
  const hasActiveFilters = activeCount > 0;
  const showFilters = filtersOpen || hasActiveFilters; // an active filter stays in view
  const serverDown = useServerDown();
  const empty = { ...emptyStateText({ serverDown, hasActiveFilters, searchQuery: search.query, viewType: activeView.type }), searching: Boolean(search.query) };

  return (
    <div className="article-list-panel">
      <ListHeader
        title={title}
        count={data.total}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        filters={{ open: showFilters, activeCount, toggle: () => setFiltersOpen((o) => !o) }}
        search={search}
        unreadCount={unreadCount}
        markAllRead={markAllRead}
      />
      {activeView.type === 'collection' && <CollectionOutBar id={activeView.id} />}
      <SearchBar search={search} inputRef={searchInputRef} />
      {showFilters && (
        <FilterBar available={data.facets} active={activeFilters} onChange={setActiveFilters} aiOnly={aiOnly} onToggleAiOnly={() => setAiOnly((v) => !v)} />
      )}
      <div ref={scrollRef} className={cn('min-h-0 flex-1 overflow-y-auto', CONTENT_PADDING[viewMode] ?? 'pb-5', selection.size > 0 && 'pb-16')}>
        <ListContent
          scrollRef={scrollRef}
          loading={data.loading && !serverDown}
          articles={visible}
          total={data.total}
          label={title}
          empty={empty}
          viewMode={viewMode}
          feedMap={data.feedMap}
          selectedArticleId={selectedArticleId}
          selection={selection}
          onSelectArticle={onSelectArticle}
          onEndReached={data.loadMore}
          ranked={Boolean(q)}
          grouping={groupingFor(activeView.type)}
        />
      </div>
      <ListKeyHints filing={isSaveList(activeView.type)} />
      <SelectionBar count={selection.size} visibleCount={visible.length} actions={actions} />
    </div>
  );
}
