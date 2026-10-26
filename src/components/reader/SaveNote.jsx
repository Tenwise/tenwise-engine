import { useCallback, useEffect, useRef, useState } from 'react';

const AUTOSAVE_MS = 800;

// Grows the field to fit its text (one line when empty).
function fitHeight(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

// The draft, saved after a pause in typing and when the field loses focus.
function useNoteDraft(article, onSave) {
  const [draft, setDraft] = useState(article.note || '');
  const savedRef = useRef(article.note || '');
  const timerRef = useRef(null);
  const flush = useCallback((text) => {
    clearTimeout(timerRef.current);
    if (text.trim() === savedRef.current.trim()) return;
    savedRef.current = text;
    onSave(article.id, text);
  }, [article.id, onSave]);
  const change = (text) => {
    setDraft(text);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flush(text), AUTOSAVE_MS);
  };
  useEffect(() => () => clearTimeout(timerRef.current), []);
  return { draft, change, flush };
}

// Enter (without Shift) or Esc finishes the note.
const isFinishKey = (e) => e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey);

function finishOnKey(e) {
  if (!isFinishKey(e)) return;
  e.preventDefault();
  e.currentTarget.blur();
}

// Shown on a saved article, one with a note, or once n has asked for it.
const isShown = (article, draft, focusRequest) => [focusRequest > 0, article.isBookmarked, draft].some(Boolean);

/**
 * The note on a saved article, under the headline. Shown once the article
 * is saved or has a note, and focused when n asks for it (focusRequest goes
 * up; it starts at 0 for each article). Writing a note saves the article.
 * Enter or Esc finishes; Shift+Enter adds a line.
 */
export default function SaveNote({ article, focusRequest, onSave, children }) {
  const fieldRef = useRef(null);
  const { draft, change, flush } = useNoteDraft(article, onSave);
  const shown = isShown(article, draft, focusRequest);

  useEffect(() => {
    if (focusRequest > 0 && shown) fieldRef.current?.focus();
  }, [focusRequest, shown]);
  useEffect(() => fitHeight(fieldRef.current), [draft, shown]);

  if (!shown) return null;
  return (
    <section aria-label="Your note" className="mb-8 border-l-2 border-primary py-0.5 pl-4">
      <label htmlFor={`note-${article.id}`} className="mb-1 block font-mono text-[11px] uppercase tracking-[0.08em] text-primary">
        {article.isBookmarked ? 'Saved · your note' : 'Your note'}
      </label>
      <textarea
        id={`note-${article.id}`}
        ref={fieldRef}
        rows={1}
        value={draft}
        onChange={(e) => change(e.target.value)}
        onBlur={() => flush(draft)}
        onKeyDown={finishOnKey}
        placeholder="What caught your eye? (n)"
        className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[15px] leading-[1.55] text-foreground outline-none placeholder:text-[var(--text-tertiary)]"
      />
      {children}
    </section>
  );
}
