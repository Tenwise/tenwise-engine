import { useCallback, useRef, useState } from 'react';
import { HiOutlineCheck, HiOutlinePencil } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/icon-button';
import { saveHighlight } from '../../utils/api.js';
import { HIGHLIGHT_COLORS } from '../../utils/constants.js';
import { TOOLBAR_WIDTH } from '../highlights/toolbarPosition.js';
import { useTextSelection } from '../highlights/useTextSelection.js';

function ColorSwatches({ value, onChange }) {
  return (
    <div className="flex gap-1.5">
      {Object.entries(HIGHLIGHT_COLORS).map(([id, bg]) => (
        <button
          key={id}
          type="button"
          title={id}
          aria-label={`${id} highlight`}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn('size-5 cursor-pointer rounded-full border-2 p-0', value === id ? 'border-foreground' : 'border-transparent')}
          style={{ background: bg }}
        />
      ))}
    </div>
  );
}

const highlightRecord = ({ article, feedTitle, sel, note, color }) => ({
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

  const save = useCallback(async () => {
    if (!sel || !article) return;
    await saveHighlight(highlightRecord({ article, feedTitle, sel, note, color }));
    setSaved(true);
    onSaved?.();
    window.getSelection()?.removeAllRanges();
    setTimeout(() => setSel(null), 700);
  }, [sel, article, feedTitle, note, color, onSaved, setSel]);

  if (!sel) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[1200] flex flex-col gap-2 rounded-lg border border-border bg-[var(--bg-modal)] p-2 shadow-xl"
      style={{ top: sel.top, left: sel.left, minWidth: TOOLBAR_WIDTH }}
    >
      <div className="flex items-center gap-2">
        <ColorSwatches value={color} onChange={setColor} />
        <IconButton active={showNote} onClick={() => setShowNote((p) => !p)} title="Add a note"><HiOutlinePencil /></IconButton>
        <button
          type="button"
          onClick={save}
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
