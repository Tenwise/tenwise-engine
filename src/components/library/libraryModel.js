/** Rows whose given fields contain the query (case-insensitive). */
export function filterRows(rows, query, fields) {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => fields.some((f) => (row[f] || '').toLowerCase().includes(q)));
}

export const truncate = (text, max) => (text.length > max ? `${text.slice(0, max)}…` : text);
