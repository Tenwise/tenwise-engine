import {
  HiOutlineArrowLeft, HiOutlineArrowRight, HiOutlineArrowTopRightOnSquare, HiOutlineArrowsPointingIn,
  HiOutlineArrowsPointingOut, HiOutlineBookmark, HiOutlineEye, HiOutlineEyeSlash, HiOutlinePencil, HiOutlineRectangleStack, HiOutlineSparkles, HiOutlineXMark,
} from 'react-icons/hi2';
import { BsBookmarkFill } from 'react-icons/bs';
import { IconButton } from '@/components/ui/icon-button';
import { Spinner } from '@/components/ui/spinner';
import { fallbackText } from './fallbackNote.js';
import ReaderSettingsMenu from './ReaderSettingsMenu.jsx';
import ShareMenu from './ShareMenu.jsx';

function NavControls({ nav }) {
  return (
    <div className="flex items-center">
      <IconButton onClick={() => nav.onNavigate(-1)} disabled={!nav.hasPrev} title="Previous article (k / ↑)"><HiOutlineArrowLeft /></IconButton>
      <span className="min-w-16 text-center font-mono text-[11px] text-muted-foreground @max-[480px]:hidden">{nav.currentIndex + 1} of {nav.totalCount.toLocaleString()}</span>
      <IconButton onClick={() => nav.onNavigate(1)} disabled={!nav.hasNext} title="Next article (j / ↓)"><HiOutlineArrowRight /></IconButton>
    </div>
  );
}

const STATUS = {
  loading: { label: 'Loading', title: 'Fetching the full article…' },
  full: { label: 'Full article', title: 'Showing the full article' },
  feed: { label: 'Feed text', title: 'Showing the feed’s text; the full article could not be fetched' },
};

function ExtractionStatus({ extraction }) {
  let state = null;
  if (extraction.extracting) state = 'loading';
  else if (extraction.content) state = 'full';
  else if (extraction.error) state = 'feed';
  if (!state) return null;
  const title = (state === 'feed' && fallbackText(extraction.failure)) || STATUS[state].title;
  return (
    <span title={title} className="ml-1 flex items-center gap-1.5 font-mono text-[10.5px] text-[var(--text-tertiary)] @max-[680px]:hidden">
      {state === 'loading' && <Spinner className="size-3 border-[1.5px]" />}
      {STATUS[state].label}
    </span>
  );
}

// Dimmed until pointed at or focused, and fully shown while one of its menus is open.
// --dimmed-opacity keeps the labels, tertiary text included, at 4.5:1 contrast.
const GROUP = 'flex items-center gap-0.5 opacity-[var(--dimmed-opacity)] transition-opacity group-hover/toolbar:opacity-100 group-focus-within/toolbar:opacity-100 has-[[data-open]]:opacity-100';

// Save (b), the note (n) and collections (c); the last two also save.
function SaveControls({ live, note }) {
  const { isBookmarked, note: text } = live.current;
  return (
    <>
      <IconButton active={isBookmarked} onClick={live.toggleBookmark} title={isBookmarked ? 'Unsave (b)' : 'Save (b)'}>
        {isBookmarked ? <BsBookmarkFill className="text-primary" /> : <HiOutlineBookmark />}
      </IconButton>
      <IconButton active={Boolean(text)} onClick={note.edit} title={text ? 'Edit your note (n)' : 'Save with a note (n)'}>
        <HiOutlinePencil className={text ? 'text-primary' : undefined} />
      </IconButton>
      <IconButton onClick={note.collect} title="Add to a collection (c)"><HiOutlineRectangleStack /></IconButton>
    </>
  );
}

// Left: close, navigation, save, note, read, extraction status.
function ArticleControls({ live, note, extraction, nav, zen }) {
  const current = live.current;
  return (
    <div className={GROUP}>
      <IconButton onClick={zen.on ? zen.exit : nav.onClose} title={zen.on ? 'Exit focus mode (Esc)' : 'Close reader (Esc)'}><HiOutlineXMark /></IconButton>
      {!zen.on && <NavControls nav={nav} />}
      <SaveControls live={live} note={note} />
      <IconButton onClick={live.toggleRead} title={current.isRead ? 'Mark as unread' : 'Mark as read'}>
        {current.isRead ? <HiOutlineEyeSlash /> : <HiOutlineEye />}
      </IconButton>
      <ExtractionStatus extraction={extraction} />
    </div>
  );
}

// Right: AI rail, focus mode, typography, share, open original.
function ViewControls({ article, zen, ai, settings }) {
  return (
    <div className={GROUP}>
      <IconButton active={ai.open} onClick={ai.toggle} title="AI rail (a)"><HiOutlineSparkles className={ai.open ? 'text-primary' : undefined} /></IconButton>
      <IconButton active={zen.on} onClick={zen.toggle} title={zen.on ? 'Exit focus mode (f)' : 'Focus mode (f)'}>
        {zen.on ? <HiOutlineArrowsPointingIn /> : <HiOutlineArrowsPointingOut />}
      </IconButton>
      <ReaderSettingsMenu settings={settings.value} onSettingsChange={settings.onChange} />
      <ShareMenu link={article.link} title={article.title} />
      <a href={article.link} target="_blank" rel="noopener noreferrer" title="Open the original (o)" className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--bg-hover)] hover:text-foreground">
        <HiOutlineArrowTopRightOnSquare className="size-4" />
      </a>
    </div>
  );
}

/** Reader toolbar: article controls on the left, view controls on the right; dimmed until pointed at or focused. */
export default function ReaderToolbar({ article, live, note, extraction, nav, zen, ai, settings }) {
  return (
    <div className="group/toolbar @container flex h-[var(--pane-header-height)] shrink-0 items-center justify-between gap-2 border-b border-border px-2">
      <ArticleControls live={live} note={note} extraction={extraction} nav={nav} zen={zen} />
      <ViewControls article={article} zen={zen} ai={ai} settings={settings} />
    </div>
  );
}
