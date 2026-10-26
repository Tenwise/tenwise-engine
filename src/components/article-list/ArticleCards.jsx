import { HiOutlineCheck, HiOutlineMagnifyingGlass, HiOutlineNewspaper, HiOutlineSparkles } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { stripHtml, timeAgo } from '../../utils/helpers.js';
import FeedFavicon from '../FeedFavicon.jsx';
import { SavedCitationButton } from '../library/Citation.jsx';
import { shortTime } from './listLogic.js';
import { OpenTitle } from './OpenTitle.jsx';

const hideOnError = (e) => { e.target.style.display = 'none'; };

// Select toggle: a check when selected, a circle on hover, hidden otherwise.
function SelectButton({ selected, onToggle, className }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      title={selected ? 'Deselect' : 'Select'}
      aria-label={selected ? 'Deselect article' : 'Select article'}
      aria-pressed={selected}
      className={cn('absolute z-10 flex size-5 cursor-pointer items-center justify-center rounded-full border-0 p-0', selected ? 'bg-primary text-primary-foreground' : 'bg-transparent opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100', className)}
    >
      {selected ? <HiOutlineCheck className="size-3" /> : <span className="size-3.5 rounded-full border border-[var(--text-tertiary)] bg-[var(--bg-primary)]" />}
    </button>
  );
}

const SourceIcon = ({ feed, className = 'size-3.5' }) => (
  <FeedFavicon src={feed?.favicon} imgClass={cn('shrink-0 rounded-sm object-contain', className)} iconClass={cn('flex shrink-0 text-[var(--text-tertiary)] [&_svg]:size-full', className)} />
);

const UnreadDot = ({ className }) => <span className={cn('size-1.5 shrink-0 rounded-full bg-primary', className)} />;
const AIBadge = () => <span className="flex shrink-0 items-center gap-0.5 font-mono text-[10.5px] text-primary" title="AI analyzed"><HiOutlineSparkles className="size-3" /> AI</span>;

// Shared surface states: open article (accent bar), selected, read (dimmed).
const surface = ({ active, selected }) => cn(
  'group/card relative cursor-pointer transition-colors',
  active && 'bg-[var(--bg-active)] shadow-[inset_2px_0_0_var(--accent)]',
  selected && 'bg-[var(--accent-muted)]',
  !active && !selected && 'hover:bg-[var(--bg-hover)]',
);
const titleTone = (read) => (read ? 'font-normal text-[var(--text-tertiary)]' : 'font-medium text-foreground');

function CompactCard({ article, feed, state, onOpen, onToggle }) {
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- pointer shortcut: the whole card opens the article; the keyboard uses the title button (OpenTitle)
    <div className={cn(surface(state), 'grid min-h-9 grid-cols-[14px_minmax(0,120px)_1fr_auto] items-center gap-3 border-b border-border py-2 pr-4 pl-5')} onClick={onOpen}>
      <SelectButton selected={state.selected} onToggle={onToggle} className="left-0.5" />
      <SourceIcon feed={feed} />
      <span className="truncate text-[11.5px] text-muted-foreground">{feed?.title || 'Unknown'}</span>
      <span className={cn('flex min-w-0 items-center gap-2 text-[13px]', titleTone(article.isRead))}>
        {!article.isRead && <UnreadDot />}
        <OpenTitle active={state.active} onOpen={onOpen} className="truncate">{article.title}</OpenTitle>
      </span>
      <span className="flex items-center gap-2">
        <SavedCitationButton article={article} feed={feed} className="-my-1 group-hover/card:opacity-100" />
        {article.aiStatus === 'done' && <AIBadge />}
        <span className="font-mono text-[11px] text-[var(--text-tertiary)]" title={timeAgo(article.publishedAt)}>{shortTime(article.publishedAt)}</span>
      </span>
    </div>
  );
}

function ExcerptCard({ article, feed, state, onOpen, onToggle }) {
  const summary = stripHtml(article.excerpt || '');
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- pointer shortcut: the whole card opens the article; the keyboard uses the title button (OpenTitle)
    <div className={cn(surface(state), 'border-b border-border py-3.5 pr-4 pl-5')} onClick={onOpen}>
      <SelectButton selected={state.selected} onToggle={onToggle} className="top-3.5 left-0.5" />
      <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        {!article.isRead && <UnreadDot />}
        <SourceIcon feed={feed} />
        <span className="truncate">{feed?.title || 'Unknown'}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <SavedCitationButton article={article} feed={feed} className="-my-1 group-hover/card:opacity-100" />
          <span className="font-mono text-[11px] text-[var(--text-tertiary)]">{timeAgo(article.publishedAt)}</span>
        </span>
        {article.aiStatus === 'done' && <AIBadge />}
      </div>
      <div className="mt-1.5 flex gap-3">
        <div className="min-w-0 flex-1">
          <OpenTitle active={state.active} onOpen={onOpen} className={cn('block w-full text-[14px] leading-snug', titleTone(article.isRead))}>
            <span className="line-clamp-2">{article.title}</span>
          </OpenTitle>
          {summary && <div className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-[var(--text-tertiary)]">{summary}</div>}
        </div>
        {article.imageUrl && <img className="size-14 shrink-0 rounded-md object-cover" src={article.imageUrl} alt="" loading="lazy" onError={hideOnError} />}
      </div>
    </div>
  );
}

function GridCard({ article, feed, state, onOpen, onToggle }) {
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- pointer shortcut: the whole card opens the article; the keyboard uses the title button (OpenTitle)
    <div className={cn(surface(state), 'flex h-full flex-col overflow-hidden rounded-lg border border-border bg-[var(--bg-secondary)]', state.active && 'border-primary')} onClick={onOpen}>
      <SelectButton selected={state.selected} onToggle={onToggle} className="top-2 left-2" />
      <div className="relative h-[150px] shrink-0 bg-[var(--bg-tertiary)]">
        {article.imageUrl
          ? <img className="size-full object-cover" src={article.imageUrl} alt="" loading="lazy" onError={hideOnError} />
          : <div className="flex size-full items-center justify-center text-[var(--text-tertiary)]"><HiOutlineNewspaper className="size-7" /></div>}
        {article.aiStatus === 'done' && <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/60 text-primary" title="AI analyzed"><HiOutlineSparkles className="size-3.5" /></span>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {!article.isRead && <UnreadDot />}
          <SourceIcon feed={feed} />
          <span className="truncate">{feed?.title || 'Unknown'}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            <SavedCitationButton article={article} feed={feed} className="-my-1 group-hover/card:opacity-100" />
            <span className="font-mono text-[10.5px] text-[var(--text-tertiary)]">{shortTime(article.publishedAt)}</span>
          </span>
        </div>
        <h3 className={cn('m-0 text-[13.5px] leading-snug', titleTone(article.isRead))}>
          <OpenTitle active={state.active} onOpen={onOpen}><span className="line-clamp-4">{article.title}</span></OpenTitle>
        </h3>
      </div>
    </div>
  );
}

const CARDS = { compact: CompactCard, excerpt: ExcerptCard, magazine: GridCard };

/** One article in the current view mode (grid "magazine", list "excerpt", or compact). */
export function ArticleCard({ viewMode, article, feed, active, selected, onSelectArticle, onToggleSelect }) {
  const Card = CARDS[viewMode] || GridCard;
  return (
    <Card
      article={article}
      feed={feed}
      state={{ active, selected }}
      onOpen={() => onSelectArticle(article)}
      onToggle={() => onToggleSelect(article.id)}
    />
  );
}

/** Placeholder rows while the list loads. */
export function LoadingCards() {
  return Array.from({ length: 8 }, (_, i) => (
    <div key={i} className="flex flex-col gap-2 border-b border-border px-5 py-3.5">
      <div className="h-3 w-1/4 animate-pulse rounded bg-[var(--bg-tertiary)]" />
      <div className="h-3.5 w-11/12 animate-pulse rounded bg-[var(--bg-tertiary)]" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--bg-tertiary)]" />
    </div>
  ));
}

/** Empty list: nothing in the view, or nothing matching the search or filters. */
export function EmptyList({ title, body, searching }) {
  const Icon = searching ? HiOutlineMagnifyingGlass : HiOutlineSparkles;
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-24 text-center">
      <Icon className="size-8 text-[var(--text-tertiary)]" />
      <h3 className="m-0 mt-2 text-[15px] font-medium text-foreground">{title}</h3>
      <p className="m-0 max-w-sm text-[13px] text-muted-foreground">{body}</p>
    </div>
  );
}
