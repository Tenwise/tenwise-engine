import { saveBlob } from './download.js';

// The docx library is large, so it loads only when a Word download is asked
// for. Builders take it as `D` (the module's exports).

function parseInline(D, text) {
  const runs = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) runs.push(new D.TextRun({ text: text.slice(last, match.index) }));
    if (match[2]) runs.push(new D.TextRun({ text: match[2], bold: true }));
    else if (match[3]) runs.push(new D.TextRun({ text: match[3], italics: true }));
    last = match.index + match[0].length;
  }
  if (last < text.length) runs.push(new D.TextRun({ text: text.slice(last) }));
  return runs.length ? runs : [new D.TextRun({ text })];
}

const HORIZONTAL_RULE = { bottom: { color: '999999', size: 6, space: 1, style: 'single' } };

// Markdown line types, checked in order; the first match wins.
const LINE_RULES = [
  { kind: 'blank', test: (t) => !t, build: (D) => new D.Paragraph({}) },
  { kind: 'h3', test: (t) => t.startsWith('### '), build: (D, t) => new D.Paragraph({ text: t.slice(4), heading: D.HeadingLevel.HEADING_3 }) },
  { kind: 'h2', test: (t) => t.startsWith('## '), build: (D, t) => new D.Paragraph({ text: t.slice(3), heading: D.HeadingLevel.HEADING_2 }) },
  { kind: 'h1', test: (t) => t.startsWith('# '), build: (D, t) => new D.Paragraph({ text: t.slice(2), heading: D.HeadingLevel.HEADING_1 }) },
  { kind: 'bullet', test: (t) => /^(\*|-) /.test(t), build: (D, t) => new D.Paragraph({ children: parseInline(D, t.slice(2)), bullet: { level: 0 } }) },
  {
    kind: 'numbered',
    test: (t) => /^\d+\. /.test(t),
    build: (D, t) => new D.Paragraph({ children: parseInline(D, t.replace(/^\d+\. /, '')), numbering: { reference: 'default', level: 0 } }),
  },
  { kind: 'rule', test: (t) => /^---+$/.test(t), build: (D) => new D.Paragraph({ border: HORIZONTAL_RULE }) },
  { kind: 'text', test: () => true, build: (D, t) => new D.Paragraph({ children: parseInline(D, t) }) },
];

const ruleFor = (line) => LINE_RULES.find((rule) => rule.test(line.trimEnd()));

/** The markdown type of one line, e.g. 'h2', 'bullet' or 'text'. */
export function markdownLineKind(line) {
  return ruleFor(line).kind;
}

function markdownToDocxChildren(D, markdown) {
  return markdown.split('\n').map((line) => ruleFor(line).build(D, line.trimEnd()));
}

function downloadBlob(blob, filename, extension) {
  saveBlob(blob, filename.replace(/[^a-z0-9\-_]/gi, '_').toLowerCase() + extension);
}

/** A Word document (Blob) from markdown; loads the docx library on first use. */
export async function markdownToDocxBlob(markdownText) {
  const D = await import('docx');
  const doc = new D.Document({
    numbering: {
      config: [{ reference: 'default', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: D.AlignmentType.LEFT }] }],
    },
    sections: [{ properties: {}, children: markdownToDocxChildren(D, markdownText) }],
  });
  return D.Packer.toBlob(doc);
}

export async function downloadAsDocx(filename, markdownText) {
  downloadBlob(await markdownToDocxBlob(markdownText), filename, '.docx');
}

export function downloadAsMarkdown(filename, text) {
  downloadBlob(new Blob([text], { type: 'text/markdown' }), filename, '.md');
}
