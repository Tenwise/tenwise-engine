import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HiOutlineXMark } from 'react-icons/hi2';
import { bulkUpdateArticles, markViewRead } from '../utils/api.js';
import { readStored, writeStored } from '../utils/storage.js';
import { useLibrary } from '../app/LibraryContext.jsx';
import { useServerDown } from '../app/useServerDown.js';
import { useToast } from '../app/ToastContext.jsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { EmptyList, LoadingCards } from './article-list/ArticleCards.jsx';
import { FilterBar } from './article-list/FilterBar.jsx';
import { DEFAULT_VIEW_MODE, viewModeOf } from './article-list/viewModes.js';
import { useRuleFilters } from './filters/useRuleFilters.js';
import { ListHeader, SearchBar } from './article-list/ListHeader.jsx';
import { SelectionBar } from './article-list/SelectionBar.jsx';
import { articlesToCSV, downloadCSV, emptyStateText, groupingFor, isSaveList, viewTitle } from './article-list/listLogic.js';
import { useArticleListData } from './article-list/useArticleListData.js';
import CollectionOutBar from './library/CollectionOutBar.jsx';
import { ToFileBar } from './library/ToFileBar.jsx';
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
const CONTENT_PADDING = { magazine: 'px-3.5 pt-3.5 pb-5', rows: 'pt-1 pb-3', compact: 'pt-1 pb-3' };

function useViewMode() {
  const [viewMode, setViewMode] = useState(() => viewModeOf(readStored(VIEW_MODE_KEY, DEFAULT_VIEW_MODE)));
  const change = useCallback((mode) => {
    const next = viewModeOf(mode);
    setViewMode(next);
    writeStored(VIEW_MODE_KEY, next);
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

// The view's current name (a feed, folder or collection may have been renamed
// since it was opened); a feed narrowed to one author, or a group of them, is named after it.
function useLiveViewTitle(activeView) {
  const { feeds, folders } = useLibrary();
  const collections = useCollections();
  const filters = useRuleFilters();
  const sources = { feed: feeds, folder: folders, collection: collections, filter: filters };
  const item = activeView.author || activeView.authorGroup ? null : (sources[activeView.type] ?? []).find((x) => x.id === activeView.id);
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
    async () => { await markViewRead(activeView.type, activeView.id, activeView.author, activeView.authorGroup); data.reload(); },
  ), [data, commit, activeView.type, activeView.id, activeView.author, activeView.authorGroup]);

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

const READ_FILTER_KEY = 'tenwise-read-filter';

// How many filters are on: the analysis pills, AI-analyzed only, and the read state.
const activeFilterCount = (filters, aiOnly, read) => Object.values(filters).filter(Boolean).length + [aiOnly, read].filter(Boolean).length;

// Unread, read or both (''), kept for this browser (PR-12).
function useReadFilter() {
  const [read, setReadState] = useState(() => {
    const stored = readStored(READ_FILTER_KEY, '');
    return stored === 'unread' || stored === 'read' ? stored : '';
  });
  const setRead = useCallback((value) => { setReadState(value); writeStored(READ_FILTER_KEY, value); }, []);
  return [read, setRead];
}

// "New since Tuesday at 9:14 PM ×": the view shows only what arrived after
// then (GRO-22); × shows the whole view again.
const sinceLabel = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' }).replace(',', ' at');

function SinceBar({ view }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2 text-[12.5px] text-muted-foreground">
      <button type="button" onClick={() => emit('open-view', { type: view.type, id: view.id })} title="Show the whole view" className="inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-muted)] px-2.5 text-[12px] text-foreground">
        New since {sinceLabel(view.since)} <HiOutlineXMark className="size-3" />
      </button>
    </div>
  );
}

// The bar under the header: what's new since a visit, a collection's exports, or Saved's filing.
function ViewBar({ view }) {
  if (view.since) return <SinceBar view={view} />;
  if (view.type === 'collection') return <CollectionOutBar id={view.id} />;
  if (view.type === 'saved') return <ToFileBar />;
  return null;
}

export default function ArticleList({
  activeView, selectedArticleId, onSelectArticle, onArticlesLoaded,
  onOpenAIPanel, refreshKey = 0, onCountChanged, changedArticle,
}) {
  const library = useLibrary();
  const [search, searchInputRef] = useSearchState();
  const [activeFilters, setActiveFilters] = useState({});
  const [aiOnly, setAiOnly] = useState(false);
  const [read, setRead] = useReadFilter();
  const q = useDebouncedValue(search.query.trim(), SEARCH_DEBOUNCE_MS);
  const data = useArticleListData(activeView, refreshKey, library.sourceFeeds, { q, filters: activeFilters, aiOnly, read });
  useReaderChanges(changedArticle, data.updateLocal);
  const title = useLiveViewTitle(activeView);
  const [viewMode, setViewMode] = useViewMode();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const selection = useSelection(`${activeView.type}:${activeView.id}`);
  const scrollRef = useRef(null);
  useScrollTopOnQuery(scrollRef, { q, activeFilters, aiOnly, read });

  const sourceOf = useCallback((article) => data.feedMap[article.feedId]?.title, [data.feedMap]);
  const visible = data.articles;
  useNotifyVisible(visible, onArticlesLoaded);
  useListKeyboard({ search, selection });

  const actions = useListActions({ data, activeView, selection, visible, sourceOf, onCountChanged, onOpenAIPanel });
  const markAllRead = useConfirmAction(actions.markAllRead);
  const unreadCount = data.unread;
  const activeCount = activeFilterCount(activeFilters, aiOnly, read);
  const hasActiveFilters = activeCount > 0;
  const showFilters = filtersOpen || hasActiveFilters; // an active filter stays in view
  const serverDown = useServerDown();
  const empty = { ...emptyStateText({ serverDown, hasActiveFilters, searchQuery: search.query, viewType: activeView.type }), searching: Boolean(search.query) };

  return (
    <div className="article-list-panel" data-tour="article-list">
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
      <ViewBar view={activeView} />
      <SearchBar search={search} inputRef={searchInputRef} />
      {showFilters && (
        <FilterBar available={data.facets} active={activeFilters} onChange={setActiveFilters} aiOnly={aiOnly} onToggleAiOnly={() => setAiOnly((v) => !v)} read={read} onReadChange={setRead} />
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
