import { HiOutlinePencilSquare } from 'react-icons/hi2';
import { deleteHighlight, fetchHighlights, fetchHighlightsDBPath, getHighlightsExportURL } from '../../utils/api.js';
import { HIGHLIGHT_COLORS } from '../../utils/constants.js';
import { ActionRow, DeleteButton, OpenInReaderButton, OriginalLink } from './ItemActions.jsx';
import { LibraryBody, LibraryHeader, LibraryScreen } from './LibraryChrome.jsx';
import { useLibraryCollection, useOpenInReader } from './useLibraryCollection.js';

const SEARCH_FIELDS = ['highlighted_text', 'note', 'article_title', 'article_source'];
const EMPTY = {
  Icon: HiOutlinePencilSquare,
  title: 'No highlights yet',
  body: 'Select any text while reading an article and click Save to keep it here.',
  noMatchTitle: 'No matching highlights',
  noMatchPrefix: 'No highlights match',
};

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');

function HighlightItem({ h, onOpenInReader, onDelete }) {
  return (
    <article className="group border-b border-border py-5">
      <blockquote
        className="m-0 border-l-[3px] pl-4 text-[16.5px] leading-relaxed text-foreground"
        style={{ borderColor: HIGHLIGHT_COLORS[h.color] || HIGHLIGHT_COLORS.yellow, fontFamily: 'var(--reader-font-family)' }}
      >
        {h.highlighted_text}
      </blockquote>
      {h.note && <p className="m-0 mt-2.5 pl-[19px] text-[13.5px] leading-relaxed text-[var(--text-secondary)]">{h.note}</p>}
      <div className="mt-3 truncate pl-[19px] font-mono text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
        {h.article_source && <span className="text-primary">{h.article_source}</span>}
        {h.article_source && ' · '}
        <span className="normal-case tracking-normal" title={h.article_title}>{h.article_title}</span> · {formatDate(h.created_at)}
      </div>
      <div className="pl-[19px]">
        <ActionRow>
          <OpenInReaderButton onClick={() => onOpenInReader(h.article_url)} />
          <OriginalLink url={h.article_url} />
          <DeleteButton what="highlight" onDelete={() => onDelete(h.id)} />
        </ActionRow>
      </div>
    </article>
  );
}

/** Saved highlights across all articles: search, open, delete, export. */
export default function HighlightsScreen({ onOpenArticle, onChanged }) {
  const collection = useLibraryCollection({ fetchRows: fetchHighlights, fetchDbPath: fetchHighlightsDBPath, deleteRow: deleteHighlight, searchFields: SEARCH_FIELDS, onChanged });
  const openInReader = useOpenInReader(onOpenArticle);
  return (
    <LibraryScreen>
      <LibraryHeader Icon={HiOutlinePencilSquare} title="Highlights" collection={collection} exportUrl={getHighlightsExportURL()} exportTitle="Export all highlights as CSV" placeholder="Search highlights and notes" />
      <LibraryBody collection={collection} empty={EMPTY}>
        {collection.filtered.map((h) => <HighlightItem key={h.id} h={h} onOpenInReader={openInReader} onDelete={collection.remove} />)}
      </LibraryBody>
    </LibraryScreen>
  );
}
