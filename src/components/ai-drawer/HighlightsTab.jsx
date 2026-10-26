import { HiOutlinePencilSquare, HiOutlineTrash } from 'react-icons/hi2';
import { HIGHLIGHT_COLORS } from '../../utils/constants.js';
import { RailEmpty } from './parts.jsx';

/** Highlights tab: this article's saved highlights. */
export default function HighlightsTab({ highlights, onDelete }) {
  if (highlights.length === 0) {
    return <div className="p-4"><RailEmpty Icon={HiOutlinePencilSquare} text="No highlights for this article yet. Select any text in the article to save one." /></div>;
  }
  return (
    <div className="flex flex-col gap-4 p-4">
      {highlights.map((h) => (
        <div key={h.id} className="group flex gap-3">
          <span className="w-[3px] shrink-0 rounded-full" style={{ background: HIGHLIGHT_COLORS[h.color] || HIGHLIGHT_COLORS.yellow }} />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[14.5px] leading-relaxed text-foreground" style={{ fontFamily: 'var(--reader-font-family)' }}>{h.highlighted_text}</p>
            {h.note && <p className="m-0 mt-1 text-xs text-muted-foreground">{h.note}</p>}
          </div>
          <button type="button" onClick={() => onDelete?.(h.id)} title="Delete highlight" aria-label="Delete highlight" className="size-7 shrink-0 cursor-pointer rounded-md border-0 bg-transparent text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--danger)] focus-visible:opacity-100">
            <HiOutlineTrash className="mx-auto size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
