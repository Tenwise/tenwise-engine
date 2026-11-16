import { HiOutlineBellAlert, HiOutlineCheck, HiOutlinePencil, HiOutlineSparkles } from 'react-icons/hi2';
import { BsBookmarkFill, BsHighlighter } from 'react-icons/bs';
import { cn } from '@/lib/utils';
import { stripHtml } from '../../utils/helpers.js';
import { shortTime } from '../article-list/listLogic.js';
import { OpenTitle } from '../article-list/OpenTitle.jsx';
import { SavedCitationButton } from '../library/Citation.jsx';

// The preview line: the AI summary when there is one, else the feed's excerpt.
const previewOf = (article) => article.aiSummary || stripHtml(article.excerpt || '', 220);

// Left gutter: a check when selected, a select circle on hover, else the unread dot.
function Gutter({ selected, unread, onToggle, compact }) {
  return (
    <button
      type="button"
      className={cn('group/sel absolute left-1 flex size-5 items-center justify-center rounded border-0 bg-transparent p-0', compact ? 'top-1.5' : 'top-2.5')}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      title={selected ? 'Deselect' : 'Select'}
      aria-label={selected ? 'Deselect article' : 'Select article'}
      aria-pressed={selected}
    >
      {selected
        ? <HiOutlineCheck className="size-3.5 text-primary" />
        : (
          <>
            <span className="hidden size-3 rounded-full border border-[var(--text-tertiary)] group-hover/row:block" />
            {unread && <span className="size-1.5 rounded-full bg-primary group-hover/row:hidden" />}
          </>
        )}
    </button>
  );
}

/**
 * One article in the Rows view (the default; UX-11): the title
 * and time, then the source and a one-line preview, with a small picture when
 * there is one; or, in Compact, all on one line (UX-12). Unread titles are
 * bright; the open article has an accent bar.
 */
const rowClass = ({ read, active, selected }) => cn(
  'article-card-row group/row relative cursor-pointer py-2 pl-7 pr-4 hover:bg-[var(--bg-hover)]',
  read && 'read',
  active && 'active bg-[var(--bg-active)] shadow-[inset_2px_0_0_var(--accent)] hover:bg-[var(--bg-active)]',
  selected && 'card-selected bg-[var(--accent-muted)]',
);

// Your note on a saved article, in place of the preview: it says why you kept it.
function NoteText({ note }) {
  return (
    <span className="flex min-w-0 items-center gap-1 text-[var(--text-secondary)]" title={note}>
      · <HiOutlinePencil className="size-3 shrink-0 text-primary" /><span className="truncate italic">{note}</span>
    </span>
  );
}

// Second line: source, your note or else the preview (the AI summary when
// there is one), then the alert, saved and AI marks (and, on hover, a saved
// article's copy-citation button).
function MetaLine({ article, feed, unread }) {
  const preview = previewOf(article);
  return (
    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-[var(--text-tertiary)]">
      <span className={cn('shrink-0', unread && 'text-[var(--text-secondary)]')}>{feed?.title || 'Unknown'}</span>
      {article.note ? <NoteText note={article.note} /> : preview && <span className="truncate">· {preview}</span>}
      <span className="ml-auto flex shrink-0 items-center gap-2 pl-2">
        <SavedCitationButton article={article} feed={feed} className="-my-1 group-hover/row:opacity-100" />
        {article.alert && <AlertMark word={article.alert} />}
        <HighlightMark count={article.highlightCount} />
        {Boolean(article.isBookmarked) && <BsBookmarkFill className="size-2.5 text-primary" title="Saved" aria-label="Saved" />}
        <AIMark article={article} />
      </span>
    </div>
  );
}

// An alert word matched (shared/rules.js, Settings → Reading → Mute and alert rules).
function AlertMark({ word }) {
  return <span className="flex items-center gap-0.5 font-mono text-[10.5px] text-[var(--warning)]" title={`Alert: ${word}`}><HiOutlineBellAlert className="size-3" />{word}</span>;
}

// How many highlights the article has (PR-7).
function HighlightMark({ count }) {
  if (!count) return null;
  const label = `${count} ${count === 1 ? 'highlight' : 'highlights'}`;
  return <span className="flex items-center gap-0.5 text-[11px]" title={label} aria-label={label}><BsHighlighter className="size-2.5" />{count}</span>;
}

// Marker of AI work on the article: summarized, or being processed.
function AIMark({ article }) {
  if (article.aiSummary) {
    return (
      <span className="flex items-center gap-1 font-mono text-[10.5px] tracking-wide text-primary" title="AI summary ready: it's the preview line">
        <HiOutlineSparkles className="size-3" /> AI
      </span>
    );
  }
  if (article.aiStatus === 'processing') return <span className="animate-pulse font-mono text-[10.5px] text-[var(--text-tertiary)]" title="AI summary in progress">AI…</span>;
  return null;
}

const hideOnError = (e) => { e.currentTarget.style.display = 'none'; };

// A small picture on the right (UX-12), when the feed gave the article one;
// nothing is fetched for it, so a long list stays fast.
function Thumbnail({ url }) {
  if (!url) return null;
  return <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={hideOnError} className="size-12 shrink-0 rounded object-cover" />;
}

const titleClass = (unread) => (unread ? 'font-medium text-foreground' : 'text-[var(--text-tertiary)]');
const Time = ({ at }) => <span className="shrink-0 font-mono text-[11.5px] text-[var(--text-tertiary)]">{shortTime(at)}</span>;

// Compact (UX-12): one line per article, source then title, the marks and the time.
function CompactLine({ article, feed, active, onOpen, unread }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={cn('w-32 shrink-0 truncate text-[12.5px]', unread ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]')}>{feed?.title || 'Unknown'}</span>
      <OpenTitle active={active} onOpen={onOpen} className={cn('min-w-0 flex-1 text-[13.5px]', titleClass(unread))}>
        <span className="block truncate">{article.title}</span>
      </OpenTitle>
      <span className="flex shrink-0 items-center gap-2">
        {article.alert && <AlertMark word={article.alert} />}
        {Boolean(article.isBookmarked) && <BsBookmarkFill className="size-2.5 text-primary" title="Saved" aria-label="Saved" />}
        <AIMark article={article} />
      </span>
      <Time at={article.publishedAt} />
    </div>
  );
}

export default function ArticleRow({ article, feed, active, selected, onOpen, onToggle, compact = false }) {
  const unread = !article.isRead;
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- pointer shortcut: the whole row opens the article; the keyboard uses the title button (OpenTitle)
    <div className={cn(rowClass({ read: article.isRead, active, selected }), compact && 'py-1.5')} onClick={onOpen}>
      <Gutter selected={selected} unread={unread} onToggle={onToggle} compact={compact} />
      {compact ? <CompactLine article={article} feed={feed} active={active} onOpen={onOpen} unread={unread} /> : (
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <OpenTitle active={active} onOpen={onOpen} className={cn('flex-1 text-[14px] leading-snug', titleClass(unread))}>
                <span className="line-clamp-2">{article.title}</span>
              </OpenTitle>
              <Time at={article.publishedAt} />
            </div>
            <MetaLine article={article} feed={feed} unread={unread} />
          </div>
          <Thumbnail url={article.imageUrl} />
        </div>
      )}
    </div>
  );
}
