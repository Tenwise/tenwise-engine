import { HiOutlineArrowTopRightOnSquare } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { estimateReadTime, formatDate } from '../../utils/helpers.js';
import { Citation } from '../library/Citation.jsx';
import { articleCitationSource } from '../library/citationModel.js';
import InCollections from './InCollections.jsx';
import SaveNote from './SaveNote.jsx';

// Kicker above the headline: source, then date, read time and author.
function Kicker({ article, feedTitle, displayContent }) {
  const details = [formatDate(article.publishedAt), estimateReadTime(displayContent), article.author && `By ${article.author}`];
  return (
    <div className="mb-4 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 font-mono text-[11.5px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
      <span className="font-semibold text-primary">{feedTitle || 'Unknown source'}</span>
      {details.filter(Boolean).map((detail) => (
        <span key={detail}><span className="mr-1 text-[var(--text-muted)]">·</span>{detail}</span>
      ))}
    </div>
  );
}

// The saved AI summary, ruled off between the headline and the body.
function InBrief({ text }) {
  return (
    <aside aria-label="In brief" className="mb-9 flex gap-[18px] border-t-2 border-b border-t-foreground border-b-border py-3.5">
      <div className="shrink-0 pt-[3px] font-mono text-[11px] uppercase tracking-[0.08em] text-primary">In brief</div>
      <p className="m-0 text-[14.5px] leading-[1.55] text-muted-foreground">{text}</p>
    </aside>
  );
}

function NoContent({ link }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <p className="m-0 text-[13.5px] text-muted-foreground">This feed sent no text for the article.</p>
      <a href={link} target="_blank" rel="noopener noreferrer"><Button><HiOutlineArrowTopRightOnSquare /> Read on the original site</Button></a>
    </div>
  );
}

// Why this is the feed's summary and not the full article (fallbackNote.js).
function FallbackNote({ text, link }) {
  return (
    <p role="note" className="mt-0 mb-6 rounded-md border border-border px-3 py-2 font-sans text-[13px] leading-relaxed text-muted-foreground">
      {text}{' '}
      <a href={link} target="_blank" rel="noopener noreferrer" title="Open the original (o)" className="text-primary">Read it on the original site</a>
    </p>
  );
}

// The body once extraction is done, under the reason the full article is
// missing when it is; with no text at all, a way to the original instead.
function ArticleText({ link, html, displayContent, fallback }) {
  return (
    <>
      {fallback && <FallbackNote text={fallback} link={link} />}
      <div className="reader-article-content" dangerouslySetInnerHTML={{ __html: html }} />
      {!displayContent && <NoContent link={link} />}
    </>
  );
}

// Under the note on a saved article: its collections and its APA citation.
function KeptDetails({ article, feed }) {
  if (!article.isBookmarked) return null;
  return (
    <>
      <InCollections articleId={article.id} />
      <Citation source={articleCitationSource(article, feed)} className="mt-3" />
    </>
  );
}

/**
 * Kicker, headline, your note, collections and citation on a saved article,
 * the AI brief when there is one, and the body. While
 * extraction runs, the feed's own HTML (if any) is shown; afterwards, the
 * best available content, under `fallback` (why the full article is missing)
 * when there is one. The body's HTML is styled by reader.css
 * (.reader-article-content), since it is arbitrary article markup.
 */
export default function ReaderBody({ article, note, brief, feed, extracting, previewHtml, html, displayContent, fallback }) {
  return (
    <>
      <Kicker article={article} feedTitle={feed?.title} displayContent={displayContent} />
      <h1
        className="m-0 mb-7 text-[clamp(30px,2.4vw+12px,44px)] leading-[1.1] font-[560] tracking-[-0.02em] text-balance text-foreground"
        style={{ fontFamily: 'var(--reader-font-family)' }}
      >
        {article.title}
      </h1>
      <SaveNote key={note.article.id} article={note.article} focusRequest={note.focusRequest} onSave={note.onSave}>
        <KeptDetails article={note.article} feed={feed} />
      </SaveNote>
      {brief && <InBrief text={brief} />}
      {extracting && previewHtml && <div className="reader-article-content" dangerouslySetInnerHTML={{ __html: previewHtml }} />}
      {!extracting && <ArticleText link={article.link} html={html} displayContent={displayContent} fallback={fallback} />}
    </>
  );
}
