import { useCallback, useRef, useState } from 'react';
import { HiOutlineCheck, HiOutlinePencil } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { emit } from '../../lib/appEvents.js';
import { IconButton } from '@/components/ui/icon-button';
import { saveHighlight } from '../../utils/api.js';
import { HIGHLIGHT_COLORS } from '../../utils/constants.js';
import { TOOLBAR_WIDTH } from '../highlights/toolbarPosition.js';
import { useTextSelection } from '../highlights/useTextSelection.js';

// The colour dots: each saves the highlight in its colour (PR-22).
function ColorSwatches({ value, onChange, disabled }) {
  return (
    <div className="flex gap-1.5">
      {Object.entries(HIGHLIGHT_COLORS).map(([id, bg]) => (
        <button
          key={id}
          type="button"
          title={`Highlight in ${id}`}
          aria-label={`Highlight in ${id}`}
          aria-pressed={value === id}
          disabled={disabled}
          onClick={() => onChange(id)}
          className={cn('size-5 cursor-pointer rounded-full border-2 p-0', value === id ? 'border-foreground' : 'border-transparent')}
          style={{ background: bg }}
        />
      ))}
    </div>
  );
}

const highlightRecord = ({ article, feedTitle, sel, note, color }) => ({
  article_id: article.id,
  article_url: article.link || '',
  article_title: article.title || '',
  article_source: feedTitle || '',
  highlighted_text: sel.text,
  note: note.trim(),
  color,
});

/** Floating toolbar for saving the selected article text as a highlight. */
export default function HighlightToolbar({ containerRef, article, feedTitle, onSaved }) {
  const [color, setColor] = useState('yellow');
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [saved, setSaved] = useState(false);
  const toolbarRef = useRef(null);
  const resetDraft = useCallback(() => { setSaved(false); setNote(''); setShowNote(false); }, []);
  const [sel, setSel] = useTextSelection(containerRef, toolbarRef, resetDraft);

  // Saves the selection in `chosen`: a colour's dot saves in that colour (PR-22), Save in the one shown.
  const save = useCallback(async (chosen = color) => {
    if (!sel || !article || saved) return;
    setColor(chosen);
    setSaved(true);
    try {
      await saveHighlight(highlightRecord({ article, feedTitle, sel, note, color: chosen }));
    } catch {
      setSaved(false); // not saved: the toolbar stays, to try again
      return;
    }
    // The server saved the article too (PR-7): the reader and the list reload it, with its highlight count.
    emit('articles-changed', [article.id]);
    onSaved?.();
    window.getSelection()?.removeAllRanges();
    setTimeout(() => setSel(null), 700);
  }, [sel, article, feedTitle, note, color, saved, onSaved, setSel]);

  if (!sel) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[1200] flex flex-col gap-2 rounded-lg border border-border bg-[var(--bg-modal)] p-2 shadow-xl"
      style={{ top: sel.top, left: sel.left, minWidth: TOOLBAR_WIDTH }}
    >
      <div className="flex items-center gap-2">
        <ColorSwatches value={color} onChange={save} disabled={saved} />
        <IconButton active={showNote} onClick={() => setShowNote((p) => !p)} title="Add a note"><HiOutlinePencil /></IconButton>
        <button
          type="button"
          onClick={() => save()}
          disabled={saved}
          className="ml-auto inline-flex h-7 cursor-pointer items-center rounded-md border-0 px-3 text-xs font-medium text-[#1a1a1a]"
          style={{ background: HIGHLIGHT_COLORS[color] }}
        >
          {saved ? <HiOutlineCheck className="size-4" /> : 'Save'}
        </button>
      </div>
      {showNote && (
        <textarea
          placeholder="Add a note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label="Note on this highlight"
          rows={2}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the note field opens when the user asks to add a note
          autoFocus
          className="w-full resize-none rounded-md border border-border bg-[var(--bg-primary)] p-2 font-sans text-[12.5px] text-foreground outline-none focus:border-primary"
        />
      )}
    </div>
  );
}
