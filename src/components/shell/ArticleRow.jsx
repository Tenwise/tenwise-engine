import { HiOutlineCheck, HiOutlinePencil, HiOutlineSparkles } from 'react-icons/hi2';
import { BsBookmarkFill } from 'react-icons/bs';
import { cn } from '@/lib/utils';
import { stripHtml } from '../../utils/helpers.js';
import { shortTime } from '../article-list/listLogic.js';
import { OpenTitle } from '../article-list/OpenTitle.jsx';
import { SavedCitationButton } from '../library/Citation.jsx';

// The preview line: the AI summary when there is one, else the feed's excerpt.
const previewOf = (article) => article.aiSummary || stripHtml(article.excerpt || '', 220);

// Left gutter: a check when selected, a select circle on hover, else the unread dot.
function Gutter({ selected, unread, onToggle }) {
  return (
    <button
      type="button"
      className="group/sel absolute left-1 top-2.5 flex size-5 items-center justify-center rounded border-0 bg-transparent p-0"
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
 * One article in the Rows view (the default "Instrument" list): the title
 * and time, then the source and a one-line preview. Unread titles are bright;
 * the open article has an accent bar.
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
// there is one), then the saved and AI marks (and, on hover, a saved
// article's copy-citation button).
function MetaLine({ article, feed, unread }) {
  const preview = previewOf(article);
  return (
    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-[var(--text-tertiary)]">
      <span className={cn('shrink-0', unread && 'text-[var(--text-secondary)]')}>{feed?.title || 'Unknown'}</span>
      {article.note ? <NoteText note={article.note} /> : preview && <span className="truncate">· {preview}</span>}
      <span className="ml-auto flex shrink-0 items-center gap-2 pl-2">
        <SavedCitationButton article={article} feed={feed} className="-my-1 group-hover/row:opacity-100" />
        {Boolean(article.isBookmarked) && <BsBookmarkFill className="size-2.5 text-primary" title="Saved" aria-label="Saved" />}
        <AIMark article={article} />
      </span>
    </div>
  );
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

export default function ArticleRow({ article, feed, active, selected, onOpen, onToggle }) {
  const unread = !article.isRead;
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- pointer shortcut: the whole row opens the article; the keyboard uses the title button (OpenTitle)
    <div className={rowClass({ read: article.isRead, active, selected })} onClick={onOpen}>
      <Gutter selected={selected} unread={unread} onToggle={onToggle} />
      <div className="flex items-baseline gap-3">
        <OpenTitle active={active} onOpen={onOpen} className={cn('flex-1 text-[14px] leading-snug', unread ? 'font-medium text-foreground' : 'text-[var(--text-tertiary)]')}>
          <span className="line-clamp-2">{article.title}</span>
        </OpenTitle>
        <span className="shrink-0 font-mono text-[11.5px] text-[var(--text-tertiary)]">{shortTime(article.publishedAt)}</span>
      </div>
      <MetaLine article={article} feed={feed} unread={unread} />
    </div>
  );
}
