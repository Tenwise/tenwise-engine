// The Markdown models write in chat answers (lists, bold, italics, code), read
// into plain data that ChatTab turns into React elements. Nothing becomes HTML:
// a link shows its text, an image or tag shows as written, so an article can't
// steer the model into loading anything in the reader's browser.

const BULLET = /^\s*[-*+•]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;

// Inline marks, first match wins: code, bold, italics, then a link (its text).
// Underscores only count at word edges, so snake_case stays as written.
const INLINE = /`([^`\n]+)`|\*\*(.+?)\*\*|(?<!\w)__(.+?)__(?!\w)|\*([^*\s](?:[^*]*?[^*\s])?)\*|(?<!\w)_([^_\s](?:[^_]*?[^_\s])?)_(?!\w)|\[([^\]\n]+)\]\([^)\s]*\)/g;

/**
 * One line's inline Markdown as spans: [{ text, bold?, italic?, code? }].
 * Bold and italics can hold each other; code holds its text as written.
 */
export function inlineSpans(line, marks = {}) {
  const spans = [];
  const plain = (text) => text && spans.push({ text, ...marks });
  let last = 0;
  for (const m of line.matchAll(INLINE)) {
    plain(line.slice(last, m.index));
    spans.push(...markedSpans(m, marks));
    last = m.index + m[0].length;
  }
  plain(line.slice(last));
  return spans;
}

// The spans of one INLINE match, inside the marks around it.
function markedSpans([, code, bold, bold2, italic, italic2, link], marks) {
  if (code !== undefined) return [{ text: code, ...marks, code: true }];
  if (bold ?? bold2) return inlineSpans(bold ?? bold2, { ...marks, bold: true });
  if (italic ?? italic2) return inlineSpans(italic ?? italic2, { ...marks, italic: true });
  return inlineSpans(link, marks);
}

// What one line is: a list item, a heading, a blank (or a rule) or a line of text.
function lineKind(line) {
  if (RULE.test(line)) return { type: 'blank' };
  const bullet = line.match(BULLET);
  if (bullet) return { type: 'ul', text: bullet[1] };
  const numbered = line.match(NUMBERED);
  if (numbered) return { type: 'ol', text: numbered[2], start: Number(numbered[1]) };
  const heading = line.match(HEADING);
  if (heading) return { type: 'h', text: heading[1] };
  return line.trim() ? { type: 'p', text: line.trim() } : { type: 'blank' };
}

/**
 * A chat answer as blocks: { type: 'p', lines }, { type: 'h', spans },
 * { type: 'ul', items } or { type: 'ol', start, items }, where lines and
 * items are inlineSpans. Consecutive text lines make one paragraph; a blank
 * line or a change of kind starts the next block.
 */
export function chatBlocks(text) {
  const blocks = [];
  let open = null;
  for (const line of (text || '').split('\n')) {
    const kind = lineKind(line);
    if (kind.type === 'blank' || kind.type === 'h') {
      if (kind.type === 'h') blocks.push({ type: 'h', spans: inlineSpans(kind.text) });
      open = null;
      continue;
    }
    if (open?.type !== kind.type) blocks.push((open = newBlock(kind)));
    (open.lines ?? open.items).push(inlineSpans(kind.text));
  }
  return blocks;
}

// An empty paragraph or list for a line of that kind; a numbered list keeps its first number.
function newBlock({ type, start }) {
  if (type === 'p') return { type, lines: [] };
  return type === 'ol' ? { type, start, items: [] } : { type, items: [] };
}
