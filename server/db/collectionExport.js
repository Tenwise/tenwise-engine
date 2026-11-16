import { apaCitation, citationMarkdown } from '../../shared/citation.js';
import { db } from './database.js';
import { getCollection } from './collections.js';
import { htmlToText } from '../utils/text.js';
import { extractArticle } from '../utils/articleExtractor.js';

// A collection as one Markdown file of sources, for NotebookLM (or any tool
// that reads Markdown): each article's title, source, dates, APA citation,
// your note, your highlights (PR-14), and its text: the feed's content, or,
// when that's a stub, the page fetched through the guarded extraction
// (PR-16). An article with neither is marked link only.

const BODY_MAX_CHARS = 40_000;
// Stored text shorter than this is a title and a stub (Lobsters sends
// "Comments"), so the page is fetched, as for bulk summaries (AI-12).
export const MIN_TEXT_CHARS = 500;
// Pages fetched per export, and at once: a 50-article collection still
// exports in well under a minute (each fetch times out at 15 s).
const MAX_FETCHES = 12;
const AT_ONCE = 4;
export const LINK_ONLY = "_Link only: the text couldn't be fetched; NotebookLM can add the link as a website source._";
const highlightsOf = db.prepare('SELECT highlighted_text AS text, note FROM highlights WHERE article_url = ? ORDER BY created_at, id');

const articlesOf = db.prepare(`
  SELECT a.title, a.link, a.source_title, a.resolved_link, a.author, a.published_at, a.saved_at, a.note, a.content, a.summary, a.description,
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
  sourceTitle: row.source_title, resolvedLink: row.resolved_link,
}));

// The article's highlights as list lines: the text, and your note on it.
const highlightLines = (link) => (link ? highlightsOf.all(link) : [])
  .map((h) => `- Highlight: “${h.text.replace(/\s+/g, ' ')}”${h.note ? ` (my note: ${h.note})` : ''}`);

const storedText = (row) => htmlToParagraphs(row.content || row.summary || row.description);

// The page's text when the stored text is a stub, or '' when it can't be had.
async function pageText(row, extract) {
  const page = await extract(row.link).catch(() => null);
  const text = htmlToParagraphs(page?.content);
  return text.length >= MIN_TEXT_CHARS ? text : '';
}

/**
 * Each row's body, { text, linkOnly }: its stored text, or its page's when
 * that's a stub (at most MAX_FETCHES, AT_ONCE at a time). linkOnly when a
 * stub's page couldn't be had, so the file says so after what text there is.
 */
export async function bodiesOf(rows, extract = extractArticle) {
  const bodies = rows.map((row) => ({ text: storedText(row), linkOnly: false }));
  const stubs = rows.map((row, i) => i).filter((i) => rows[i].link && bodies[i].text.length < MIN_TEXT_CHARS);
  const fetched = stubs.slice(0, MAX_FETCHES);
  for (let start = 0; start < fetched.length; start += AT_ONCE) {
    const batch = fetched.slice(start, start + AT_ONCE);
    const pages = await Promise.all(batch.map((i) => pageText(rows[i], extract)));
    batch.forEach((i, k) => { if (pages[k]) bodies[i].text = pages[k]; });
  }
  for (const i of stubs) bodies[i].linkOnly = bodies[i].text.length < MIN_TEXT_CHARS;
  return bodies;
}

function articleSection(row, body) {
  const lines = [`## ${row.title || 'Untitled'}`, ''];
  lines.push(`- Source: ${row.feed_title || 'Unknown'}${row.link ? ` (${row.link})` : ''}`);
  lines.push(`- Published ${day(row.published_at)} · saved ${day(row.saved_at)}`);
  lines.push(`- Cite (APA 7): ${citationOf(row)}`);
  if (row.note) lines.push(`- My note: ${row.note}`);
  lines.push(...highlightLines(row.link));
  const text = [body.text, body.linkOnly && LINK_ONLY].filter(Boolean).join('\n\n');
  lines.push('', text || '_No text was stored for this article._');
  return lines.join('\n');
}

/**
 * The collection's sources as Markdown, { name, markdown, linkOnly } with the
 * count of articles marked link only, or null if it doesn't exist. `extract`
 * is extractArticle's signature (tests pass a stub).
 */
export async function collectionMarkdown(id, { now = new Date(), extract = extractArticle } = {}) {
  const collection = getCollection(id);
  if (!collection) return null;
  const rows = articlesOf.all(id);
  const bodies = await bodiesOf(rows, extract);
  const header = [
    `# ${collection.name}`,
    '',
    ...(collection.description ? [collection.description, ''] : []),
    `Collected in Tenwise: ${rows.length} article${rows.length === 1 ? '' : 's'}, exported ${day(now.toISOString())}.`,
  ].join('\n');
  const linkOnly = bodies.filter((b) => b.linkOnly).length;
  return { name: collection.name, markdown: [header, ...rows.map((row, i) => articleSection(row, bodies[i]))].join('\n\n---\n\n') + '\n', linkOnly };
}
