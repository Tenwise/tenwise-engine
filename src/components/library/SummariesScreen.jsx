import { memo, useState } from 'react';
import { HiOutlineSparkles } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { useLibrary } from '../../app/LibraryContext.jsx';
import { deleteSummary, fetchDBPath, fetchSummaries, getSummariesExportURL } from '../../utils/api.js';
import { voices } from '../../ai/voice.js';
import { Citation } from './Citation.jsx';
import { summaryCitationSource } from './citationModel.js';
import { ActionRow, DeleteButton, OpenInReaderButton, OriginalLink } from './ItemActions.jsx';
import { LibraryBody, LibraryHeader, LibraryScreen } from './LibraryChrome.jsx';
import { useLibraryCollection, useOpenInReader } from './useLibraryCollection.js';

const SEARCH_FIELDS = ['article_title', 'summary_text', 'article_source'];
const EMPTY = {
  Icon: HiOutlineSparkles,
  title: 'No summaries saved yet',
  body: 'Open an article, generate a summary in the AI rail, then click Save to keep it here.',
  noMatchTitle: 'No matching summaries',
  noMatchPrefix: 'No summaries match',
};

const formatDate = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

const Chip = ({ children }) => <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{children}</span>;

// How the summary was made: the voice (voice.js), the model; and the article's byline.
function Provenance({ row }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {voices().map(({ id, Chips }) => Chips && <Chips key={id} row={row} Chip={Chip} />)}
      {row.ai_model && <Chip>{row.ai_model.split(':')[0]}</Chip>}
      {row.article_author && <span className="ml-1 text-xs text-muted-foreground">By {row.article_author}</span>}
    </div>
  );
}

const SummaryItem = memo(function SummaryItem({ row, feeds, onDelete, onOpenInReader }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="group border-b border-border py-5">
      <div className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
        <span className="text-primary">{row.article_source || 'Unknown source'}</span> · {formatDate(row.created_at)}
      </div>
      <h3 className="m-0 mt-1.5 text-[15.5px] font-medium leading-snug text-foreground">{row.article_title || row.article_url || 'Untitled'}</h3>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- pointer shortcut; the More/Less button below does the same from the keyboard */}
      <p
        className={cn('m-0 mt-2 cursor-pointer text-[15.5px] leading-relaxed text-[var(--text-secondary)]', !expanded && 'line-clamp-3')}
        style={{ fontFamily: 'var(--reader-font-family)' }}
        onClick={() => setExpanded((e) => !e)}
        title={expanded ? 'Show less' : 'Show all'}
      >
        {row.summary_text}
      </p>
      {expanded && <Provenance row={row} />}
      <Citation source={summaryCitationSource(row, feeds)} className="mt-3" />
      <ActionRow>
        <button type="button" onClick={() => setExpanded((e) => !e)} className="inline-flex h-7 cursor-pointer items-center rounded-md border-0 bg-transparent px-2 text-xs text-muted-foreground hover:bg-[var(--bg-hover)] hover:text-foreground">
          {expanded ? 'Less' : 'More'}
        </button>
        <OpenInReaderButton onClick={() => onOpenInReader(row.article_url)} />
        <OriginalLink url={row.article_url} />
        <DeleteButton what="summary" onDelete={() => onDelete(row.id)} />
      </ActionRow>
    </article>
  );
});

/** Saved AI summaries: search, read, cite, open the article, delete, export. */
export default function SummariesScreen({ onOpenArticle, onChanged }) {
  const collection = useLibraryCollection({ fetchRows: fetchSummaries, fetchDbPath: fetchDBPath, deleteRow: deleteSummary, searchFields: SEARCH_FIELDS, onChanged });
  const openInReader = useOpenInReader(onOpenArticle);
  const { sourceFeeds } = useLibrary();
  return (
    <LibraryScreen>
      <LibraryHeader Icon={HiOutlineSparkles} title="AI Summaries" collection={collection} exportUrl={getSummariesExportURL()} exportTitle="Export all summaries as CSV" placeholder="Search summaries" />
      <LibraryBody collection={collection} empty={EMPTY}>
        {collection.filtered.map((row) => <SummaryItem key={row.id} row={row} feeds={sourceFeeds} onDelete={collection.remove} onOpenInReader={openInReader} />)}
      </LibraryBody>
    </LibraryScreen>
  );
}
