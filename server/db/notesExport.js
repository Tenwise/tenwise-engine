// What you made from your reading (PR-14): your saves, or one collection,
// with each article's title, source, link, APA citation, your note and your
// highlights (with their notes), but not the articles' text. As Markdown
// (Obsidian, Notion) or HTML (OneNote, Word, Notion). Everything from the
// database is escaped in HTML; nothing is fetched.
import { apaCitation, citationHtml, citationMarkdown } from '../../shared/citation.js';
import { db } from './database.js';
import { getCollection } from './collections.js';

const COLUMNS = 'a.id, a.title, a.link, a.source_title, a.resolved_link, a.author, a.published_at, a.saved_at, a.note, f.title AS feed_title, f.site_url';
const savedRows = db.prepare(`SELECT ${COLUMNS} FROM articles a LEFT JOIN feeds f ON f.id = a.feed_id WHERE a.is_bookmarked = 1 ORDER BY a.saved_at DESC, a.id DESC`);
const collectionRows = db.prepare(`
  SELECT ${COLUMNS} FROM collection_items i JOIN articles a ON a.id = i.article_id LEFT JOIN feeds f ON f.id = a.feed_id
  WHERE i.collection_id = ? ORDER BY a.saved_at DESC, a.id DESC
`);
const highlightsOf = db.prepare('SELECT highlighted_text AS text, note FROM highlights WHERE article_url = ? ORDER BY created_at, id');

const day = (iso) => (iso ? iso.slice(0, 10) : '');
const citationRuns = (row) => apaCitation({
  author: row.author, publishedAt: row.published_at, title: row.title, link: row.link, siteName: row.feed_title, siteUrl: row.site_url,
  sourceTitle: row.source_title, resolvedLink: row.resolved_link,
});
const withHighlights = (rows) => rows.map((row) => ({ ...row, highlights: row.link ? highlightsOf.all(row.link) : [] }));

/** The rows to export: a collection's, or every save; null for a collection that doesn't exist. */
export function notesOf({ collectionId } = {}) {
  if (collectionId === undefined) return { title: 'Your saves', rows: withHighlights(savedRows.all()) };
  const collection = getCollection(collectionId);
  return collection ? { title: collection.name, description: collection.description, rows: withHighlights(collectionRows.all(collectionId)) } : null;
}

const plural = (n) => `${n} article${n === 1 ? '' : 's'}`;
const quoteMd = (text) => String(text).split('\n').map((l) => `> ${l}`).join('\n');

function articleMd(row) {
  const lines = [`## ${row.title || 'Untitled'}`, ''];
  lines.push(`- Source: ${row.feed_title || 'Unknown'}${row.link ? ` (${row.link})` : ''}`);
  if (row.saved_at) lines.push(`- Saved ${day(row.saved_at)}`);
  lines.push(`- Cite (APA 7): ${citationMarkdown(citationRuns(row))}`);
  if (row.note) lines.push('', `**My note:** ${row.note}`);
  for (const h of row.highlights) {
    lines.push('', quoteMd(h.text));
    if (h.note) lines.push('', `— ${h.note}`);
  }
  return lines.join('\n');
}

/** Markdown: a heading, then one section per article. */
export function notesMarkdown({ title, description, rows }, now = new Date()) {
  const head = [`# ${title}`, '', ...(description ? [description, ''] : []), `Exported from Tenwise ${day(now.toISOString())}: ${plural(rows.length)}, with your notes and highlights.`].join('\n');
  return `${[head, ...rows.map(articleMd)].join('\n\n---\n\n')}\n`;
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
// Only http(s) links become links; anything else stays text.
const linkOf = (url) => (/^https?:\/\//i.test(url ?? '') ? `<a href="${esc(url)}">${esc(url)}</a>` : esc(url));

function articleHtml(row) {
  const parts = [`<h2>${esc(row.title || 'Untitled')}</h2>`, '<ul>'];
  parts.push(`<li>Source: ${esc(row.feed_title || 'Unknown')}${row.link ? ` (${linkOf(row.link)})` : ''}</li>`);
  if (row.saved_at) parts.push(`<li>Saved ${esc(day(row.saved_at))}</li>`);
  parts.push(`<li>Cite (APA 7): ${citationHtml(citationRuns(row))}</li>`, '</ul>');
  if (row.note) parts.push(`<p><strong>My note:</strong> ${esc(row.note)}</p>`);
  for (const h of row.highlights) {
    parts.push(`<blockquote>${esc(h.text)}</blockquote>`);
    if (h.note) parts.push(`<p>— ${esc(h.note)}</p>`);
  }
  return parts.join('\n');
}

/** HTML: a standalone page OneNote, Word and Notion open or import. */
export function notesHtml({ title, description, rows }, now = new Date()) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title></head>
<body>
<h1>${esc(title)}</h1>
${description ? `<p>${esc(description)}</p>\n` : ''}<p>Exported from Tenwise ${esc(day(now.toISOString()))}: ${plural(rows.length)}, with your notes and highlights.</p>
${rows.map(articleHtml).join('\n<hr>\n')}
</body></html>
`;
}
