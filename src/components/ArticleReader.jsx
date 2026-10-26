import { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../utils/api.js';
import { on } from '../lib/appEvents.js';
import { getReaderCSSVars, getReaderSettings } from '../utils/readerSettings.js';
import { htmlToText } from '../utils/helpers.js';
import { useOnKeyChange } from '../hooks/useOnKeyChange.js';
import AIRail from './ai-drawer/AIRail.jsx';
import HighlightToolbar from './reader/HighlightToolbar.jsx';
import ResizableHandle from './shell/ResizableHandle.jsx';
import ReaderBody from './reader/ReaderBody.jsx';
import ReaderToolbar from './reader/ReaderToolbar.jsx';
import { fallbackNote } from './reader/fallbackNote.js';
import { sanitizeArticleHtml, sanitizeFeedHtml } from './reader/sanitize.js';
import { briefOf, panelLayout } from './reader/panelLayout.js';
import { useAIRail } from './reader/useAIRail.js';
import { useArticleExtraction } from './reader/useArticleExtraction.js';
import { applyHighlights, useArticleHighlights } from './reader/useArticleHighlights.js';
import { useLiveArticle } from './reader/useLiveArticle.js';
import { useNoteEditing } from './reader/useNoteEditing.js';
import { useReaderKeyboard } from './reader/useReaderKeyboard.js';
import { useReaderScroll } from './reader/useReaderScroll.js';

// The article's feed (its site is in the citation) and its title (for the
// meta line, AI context, highlights and the citation).
function useFeed(feedId) {
  const [feed, setFeed] = useState(null);
  useOnKeyChange(feedId, () => setFeed(null));
  useEffect(() => {
    if (feedId) api.fetchFeed(feedId).then(setFeed).catch(() => setFeed(null));
  }, [feedId]);
  return { feed, title: feed?.title || null };
}

// Slide-in animation: becomes visible just after opening, hidden on close.
function useSlideIn(isOpen) {
  const [visible, setVisible] = useState(false);
  useOnKeyChange(isOpen, () => { if (!isOpen) setVisible(false); });
  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(timer);
  }, [isOpen]);
  return visible;
}

// Reader typography; Settings changes it too (via an app event).
function useReaderSettingsState() {
  const [settings, setSettings] = useState(getReaderSettings);
  useEffect(() => on('reader-settings', setSettings), []);
  return [settings, setSettings];
}

// Best available content: extracted full text, else the feed's own HTML, with
// a note on why when that is only a short summary (fallbackNote.js).
function useArticleContent(current, extraction) {
  const feedHtml = current?.content || current?.summary || '';
  const displayContent = extraction.content || feedHtml;
  const html = useMemo(() => sanitizeArticleHtml(displayContent), [displayContent]);
  const previewHtml = useMemo(() => (feedHtml ? sanitizeFeedHtml(feedHtml) : ''), [feedHtml]);
  const fallback = useMemo(() => fallbackNote(extraction.failure, htmlToText(feedHtml)), [extraction.failure, feedHtml]);
  return { displayContent, html, previewHtml, fallback };
}

// Focus ("zen") mode plus the reader's keyboard shortcuts, which depend on it.
function useZenAndKeyboard({ isOpen, isModalOpen, hasPrev, hasNext, onNavigate, onClose, link, toggleBookmark, toggleAI, note }) {
  const [on, setOn] = useState(false);
  const keyboardActions = useMemo(() => ({
    isModalOpen, hasPrev, hasNext, onNavigate, link, toggleBookmark, toggleAI,
    editNote: note.edit,
    collect: note.collect,
    toggleZen: () => setOn((z) => !z),
    escape: () => (on ? setOn(false) : onClose()),
  }), [isModalOpen, hasPrev, hasNext, onNavigate, link, toggleBookmark, toggleAI, note.edit, note.collect, on, onClose]);
  useReaderKeyboard(isOpen, keyboardActions);
  return { on, exit: () => setOn(false), toggle: () => setOn((z) => !z) };
}

// Click outside the overlay reader to close it (or leave focus mode).
function Backdrop({ className, onClick }) {
  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- pointer-only backdrop; Esc does the same from the keyboard (useReaderKeyboard)
  return <div className={className} onClick={onClick} />;
}

export default function ArticleReader({
  article, isOpen, isModalOpen, onClose, onNavigate, hasNext, hasPrev, currentIndex, totalCount,
  width, onResize, onSummarySaved, onArticleChanged,
}) {
  const [readerSettings, setReaderSettings] = useReaderSettingsState();
  const rail = useAIRail();
  const contentRef = useRef(null);

  const { id: articleId, link, feedId } = article || {};
  const live = useLiveArticle(article, onArticleChanged);
  const current = live.current;
  const extraction = useArticleExtraction(articleId, link);
  const { highlights, reload: reloadHighlights, remove: removeHighlight } = useArticleHighlights(articleId, link);
  const { feed, title: feedTitle } = useFeed(feedId);
  const progress = useReaderScroll(contentRef, articleId, isOpen, extraction.settled);
  const visible = useSlideIn(isOpen);
  const note = useNoteEditing(articleId, live);
  const zen = useZenAndKeyboard({ isOpen, isModalOpen, hasPrev, hasNext, onNavigate, onClose, link, toggleBookmark: live.toggleBookmark, toggleAI: rail.toggle, note });
  const { displayContent, html, previewHtml, fallback } = useArticleContent(current, extraction);
  const cssVars = useMemo(() => getReaderCSSVars(readerSettings), [readerSettings]);

  // Draw saved highlights onto the rendered article.
  useEffect(() => {
    const container = contentRef.current?.querySelector('.reader-article-content');
    if (container) applyHighlights(container, highlights);
  }, [highlights, html, extraction.extracting]);

  if (!article) return null;

  const panel = panelLayout({ visible, zen, rail, width });

  return (
    <>
      <Backdrop className={`reader-overlay-backdrop ${panel.stateClasses}`} onClick={zen.on ? zen.exit : onClose} />

      <div className={panel.className} style={panel.style}>
        <div className="reading-progress-bar" style={{ width: `${progress}%` }} />
        {!zen.on && <ResizableHandle overlay onResize={onResize} />}

        <div className="reader-main">
          <ReaderToolbar
            article={article}
            live={live} note={note}
            extraction={extraction}
            nav={{ onNavigate, onClose, hasPrev, hasNext, currentIndex, totalCount }}
            zen={zen}
            ai={{ open: rail.open, toggle: rail.toggle }}
            settings={{ value: readerSettings, onChange: setReaderSettings }}
          />

          <div className="reader-content" ref={contentRef} style={cssVars}>
            <ReaderBody
              article={article} note={{ article: current, focusRequest: note.request, onSave: live.saveNote }}
              brief={briefOf(current, article)}
              feed={feed}
              extracting={extraction.extracting}
              previewHtml={previewHtml}
              html={html}
              displayContent={displayContent} fallback={fallback}
            />
          </div>
        </div>

        <AIRail
          isOpen={rail.open}
          onClose={rail.toggle}
          width={rail.width}
          onResize={rail.resize}
          article={current}
          extractedContent={extraction.content}
          feedTitle={feedTitle}
          onSummarySaved={onSummarySaved}
          highlights={highlights}
          onHighlightDeleted={removeHighlight}
        />
      </div>

      <HighlightToolbar containerRef={contentRef} article={current} feedTitle={feedTitle || ''} onSaved={reloadHighlights} />
    </>
  );
}
