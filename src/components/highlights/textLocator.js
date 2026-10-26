// Finds a highlight's text across several text segments (the text nodes of the
// rendered article). Whitespace is ignored when matching: a selection that
// spans paragraphs or inline elements has line breaks and spaces that the
// DOM's text nodes do not, and vice versa.

const isSpace = (ch) => /\s/.test(ch);

/**
 * Where `text` first occurs across `segments`, as one { segment, start, end }
 * range per segment it touches (end exclusive), or [] when it does not occur.
 */
export function locateAcrossSegments(segments, text) {
  const needle = [...text].filter((ch) => !isSpace(ch)).join('');
  if (!needle) return [];

  // The non-space characters of all segments, each with its position.
  let haystack = '';
  const positions = [];
  segments.forEach((value, segment) => {
    for (let offset = 0; offset < value.length; offset++) {
      if (isSpace(value[offset])) continue;
      haystack += value[offset];
      positions.push({ segment, offset });
    }
  });

  const found = haystack.indexOf(needle);
  if (found === -1) return [];
  return rangesBetween(segments, positions[found], positions[found + needle.length - 1]);
}

// The range shrunk to its first and last non-space characters, or null if blank.
function trimRange(value, segment, start, end) {
  while (start < end && isSpace(value[start])) start++;
  while (end > start && isSpace(value[end - 1])) end--;
  return end > start ? { segment, start, end } : null;
}

// One range per segment from `first` to `last` (inclusive character positions).
function rangesBetween(segments, first, last) {
  const ranges = [];
  for (let segment = first.segment; segment <= last.segment; segment++) {
    const start = segment === first.segment ? first.offset : 0;
    const end = segment === last.segment ? last.offset + 1 : segments[segment].length;
    const range = trimRange(segments[segment], segment, start, end);
    if (range) ranges.push(range);
  }
  return ranges;
}
