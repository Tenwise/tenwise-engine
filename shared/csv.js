// Shared by the browser (article list export) and the server (summaries and
// highlights exports): one way to write a CSV cell.

// A cell starting with one of these is run as a formula by Excel, Sheets and
// LibreOffice. Feed titles and AI output are untrusted, so such cells get a
// leading apostrophe, which spreadsheets show as plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

/** One CSV cell: formula-safe, quoted when it holds a comma, quote or line break. */
export function csvCell(value) {
  if (value == null) return '';
  let s = String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
