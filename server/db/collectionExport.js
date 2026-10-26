import { apaCitation, citationMarkdown } from '../../shared/citation.js';
import { db } from './database.js';
import { getCollection } from './collections.js';
import { htmlToText } from '../utils/text.js';

// A collection as one Markdown file of sources, for NotebookLM (or any tool
// that reads Markdown): each article's title, source, dates, APA citation,
// your note, and its text as stored (the feed's content; the reader extracts
// full text only on open, so some articles are excerpts and NotebookLM can
// follow the link).

const BODY_MAX_CHARS = 40_000;

const articlesOf = db.prepare(`
  SELECT a.title, a.link, a.author, a.published_at, a.saved_at, a.note, a.content, a.summary, a.description,
    f.title AS feed_title, f.site_url
  FROM collection_items i
  JOIN articles a ON a.id = i.article_id
  LEFT JOIN feeds f ON f.id = a.feed_id
  WHERE i.collection_id = ?
  ORDER BY a.saved_at DESC, a.id DESC
`);

// Paragraph breaks survive: block ends become blank lines before tags go.
const BLOCK_END = /<\/(?:p|h[1-6]|li|blockquote|div|pre)>|<br\s*\/?>/gi;

/** Plain text in paragraphs, cut at `max` characters. */
export function htmlToParagraphs(html, max = BODY_MAX_CHARS) {
  if (!html) return '';
  const text = String(html).replace(BLOCK_END, '\n\n').split(/\n{2,}/).map(htmlToText).filter(Boolean).join('\n\n');
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

const day = (iso) => (iso ? iso.slice(0, 10) : 'unknown');

const citationOf = (row) => citationMarkdown(apaCitation({
  author: row.author, publishedAt: row.published_at, title: row.title, link: row.link, siteName: row.feed_title, siteUrl: row.site_url,
}));

function articleSection(row) {
  const lines = [`## ${row.title || 'Untitled'}`, ''];
  lines.push(`- Source: ${row.feed_title || 'Unknown'}${row.link ? ` (${row.link})` : ''}`);
  lines.push(`- Published ${day(row.published_at)} · saved ${day(row.saved_at)}`);
  lines.push(`- Cite (APA 7): ${citationOf(row)}`);
  if (row.note) lines.push(`- My note: ${row.note}`);
  const body = htmlToParagraphs(row.content || row.summary || row.description);
  lines.push('', body || '_No text was stored for this article; see the link above._');
  return lines.join('\n');
}

/** The collection's sources as Markdown, or null if it doesn't exist. */
export function collectionMarkdown(id, now = new Date()) {
  const collection = getCollection(id);
  if (!collection) return null;
  const rows = articlesOf.all(id);
  const header = [
    `# ${collection.name}`,
    '',
    ...(collection.description ? [collection.description, ''] : []),
    `Collected in Tenwise: ${rows.length} article${rows.length === 1 ? '' : 's'}, exported ${day(now.toISOString())}.`,
  ].join('\n');
  return { name: collection.name, markdown: [header, ...rows.map(articleSection)].join('\n\n---\n\n') + '\n' };
}
