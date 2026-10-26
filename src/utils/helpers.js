import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';

/**
 * Remove HTML tags, applying the regex repeatedly until the string stops
 * changing. A single pass can leave a tag behind for malformed/nested input
 * like `<scr<script>ipt>`, where removing the inner tag reforms an outer one.
 */
// Removes every `<...>` span in one linear pass (no regex backtracking on
// input like "<<<<…"). Once no closing `>` remains, the rest is kept as text.
function stripTags(input) {
  const s = String(input);
  let out = '';
  let i = 0;
  while (i < s.length) {
    const open = s.indexOf('<', i);
    if (open === -1) break;
    const close = s.indexOf('>', open + 1);
    if (close === -1) break;
    out += s.slice(i, open);
    i = close + 1;
  }
  return out + s.slice(i);
}

/**
 * Format a date as a human-readable relative time string.
 */
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '';
  }
}

/**
 * Format a date for display in article reader.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    if (isToday(date)) return `Today at ${format(date, 'h:mm a')}`;
    if (isYesterday(date)) return `Yesterday at ${format(date, 'h:mm a')}`;
    return format(date, 'MMM d, yyyy · h:mm a');
  } catch {
    return '';
  }
}

/**
 * Estimate reading time from text content.
 */
export function estimateReadTime(content) {
  if (!content) return '1 min read';
  // Strip HTML tags for word count
  const text = stripTags(content);
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}

/**
 * Convert HTML to plain text with collapsed whitespace — the full text, not
 * a snippet. Use this for AI context; callers apply their own length limits.
 */
export function htmlToText(html) {
  if (!html) return '';
  return stripTags(html).replace(/\s+/g, ' ').trim();
}

/**
 * Strip HTML tags and return a short plain-text snippet (default 160 chars),
 * for previews and list rows.
 */
export function stripHtml(html, maxLength = 160) {
  const text = htmlToText(html);
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Favicon URL for a website, served and cached by our own server
 * (GET /api/favicon/:host) so no third party learns which sites are followed.
 */
export function getFaviconUrl(siteUrl) {
  if (!siteUrl) return '';
  try {
    const url = new URL(siteUrl);
    return `/api/favicon/${url.hostname}`;
  } catch {
    return '';
  }
}

/**
 * Normalize a URL by ensuring it has a protocol.
 */
export function normalizeUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
}
