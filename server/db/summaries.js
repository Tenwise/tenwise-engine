import { csvCell } from '../../shared/csv.js';
import { db, DB_PATH } from './database.js';

const insert = db.prepare(`
  INSERT INTO summaries (
    created_at,
    article_title, article_url, article_author, article_source, article_published_at,
    summary_text,
    ai_model, ai_personas, ai_tone_voice, ai_tone_energy, ai_tone_angle, ai_custom_instructions
  ) VALUES (
    @created_at,
    @article_title, @article_url, @article_author, @article_source, @article_published_at,
    @summary_text,
    @ai_model, @ai_personas, @ai_tone_voice, @ai_tone_energy, @ai_tone_angle, @ai_custom_instructions
  )
`);

const getAll = db.prepare(`
  SELECT * FROM summaries ORDER BY created_at DESC
`);

const getById = db.prepare(`
  SELECT * FROM summaries WHERE id = ?
`);

const deleteById = db.prepare(`
  DELETE FROM summaries WHERE id = ?
`);

// Optional summary columns, stored as NULL when missing or empty.
const OPTIONAL_FIELDS = [
  'article_title', 'article_url', 'article_author', 'article_source', 'article_published_at',
  'ai_model', 'ai_tone_voice', 'ai_tone_energy', 'ai_tone_angle', 'ai_custom_instructions',
];

const personasColumn = (personas) => (Array.isArray(personas) ? JSON.stringify(personas) : personas || null);

export function saveSummary(data) {
  const row = Object.fromEntries(OPTIONAL_FIELDS.map((key) => [key, data[key] || null]));
  const info = insert.run({
    ...row,
    created_at: new Date().toISOString(),
    summary_text: data.summary_text,
    ai_personas: personasColumn(data.ai_personas),
  });
  return getById.get(info.lastInsertRowid);
}

export function getAllSummaries() {
  return getAll.all();
}

export function removeSummary(id) {
  const result = deleteById.run(id);
  return result.changes > 0;
}

export function buildCSV() {
  const rows = getAll.all();
  const headers = [
    'ID', 'Saved At',
    'Article Title', 'Article URL', 'Article Author', 'Article Source', 'Article Published',
    'Summary',
    'AI Model', 'AI Personas', 'Voice', 'Energy', 'Angle', 'Custom Instructions',
  ];

  const lines = [
    headers.join(','),
    ...rows.map((r) => [
      r.id,
      csvCell(r.created_at),
      csvCell(r.article_title),
      csvCell(r.article_url),
      csvCell(r.article_author),
      csvCell(r.article_source),
      csvCell(r.article_published_at),
      csvCell(r.summary_text),
      csvCell(r.ai_model),
      csvCell(r.ai_personas),
      csvCell(r.ai_tone_voice),
      csvCell(r.ai_tone_energy),
      csvCell(r.ai_tone_angle),
      csvCell(r.ai_custom_instructions),
    ].join(',')),
  ];

  return lines.join('\n');
}

export { DB_PATH };
