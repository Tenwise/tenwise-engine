import { csvCell } from '../../shared/csv.js';
import { db, DB_PATH } from './database.js';

const insert = db.prepare(`
  INSERT INTO highlights (created_at, article_url, article_title, article_source, highlighted_text, note, color)
  VALUES (@created_at, @article_url, @article_title, @article_source, @highlighted_text, @note, @color)
`);

const getAll = db.prepare(`SELECT * FROM highlights ORDER BY created_at DESC`);
const getByUrl = db.prepare(`SELECT * FROM highlights WHERE article_url = ? ORDER BY created_at DESC`);
const getById = db.prepare(`SELECT * FROM highlights WHERE id = ?`);
const deleteById = db.prepare(`DELETE FROM highlights WHERE id = ?`);
const countAll = db.prepare(`SELECT COUNT(*) AS count FROM highlights`);

export function saveHighlight(data) {
  const info = insert.run({
    created_at: new Date().toISOString(),
    article_url: data.article_url || null,
    article_title: data.article_title || null,
    article_source: data.article_source || null,
    highlighted_text: data.highlighted_text,
    note: data.note || null,
    color: data.color || 'yellow',
  });
  return getById.get(info.lastInsertRowid);
}

export function getAllHighlights() {
  return getAll.all();
}

export function getHighlightsByArticleUrl(url) {
  return getByUrl.all(url);
}

export function removeHighlight(id) {
  const result = deleteById.run(id);
  return result.changes > 0;
}

export function getHighlightsCount() {
  return countAll.get().count;
}

export function buildCSV() {
  const rows = getAll.all();
  const headers = ['ID', 'Saved At', 'Highlighted Text', 'Note', 'Color', 'Article Title', 'Source', 'Article URL'];

  const lines = [
    headers.join(','),
    ...rows.map((r) => [
      r.id,
      csvCell(r.created_at),
      csvCell(r.highlighted_text),
      csvCell(r.note),
      csvCell(r.color),
      csvCell(r.article_title),
      csvCell(r.article_source),
      csvCell(r.article_url),
    ].join(',')),
  ];

  return lines.join('\n');
}

export { DB_PATH };
