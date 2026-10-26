import { apaAuthorList, apaAuthors, decodeLatex, oneLine, sameName, squash } from './citationAuthors.js';
import { withoutTracking } from './feedItems.js';

// APA 7 references for kept articles, built on demand from what Tenwise
// stores: the author field, publication date, title and link, and the feed's
// title and site URL. A reference is a list of runs, { text, italic }, so the
// UI, Markdown and rich-text copies italicize the same parts.
//
// Feed items are articles in periodicals (news sites, magazines, blogs):
//   Author, A. (2026, October 21). Title. *Site*. https://…
// arXiv papers are preprints, cited by year with the arXiv ID:
//   Author, A. (2026). *Title* (arXiv:2610.12345). arXiv. https://arxiv.org/abs/2610.12345
// Titles stay as published. APA asks for sentence case, but lower-casing by
// rule breaks proper nouns ("OpenAI", "Amodei"), so that edit is the writer's.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ARXIV_ID = /arxiv\.org\/(?:abs|pdf|html)\/([a-z-]+(?:\.[a-z]{2})?\/\d{7}|\d{4}\.\d{4,5})(?:v\d+)?/i;
// "Engadget - Technology News & Expert Reviews", "Aeon | a world of ideas"
const TAGLINE = /\s+[-–—|·]\s+/;
// Host labels that don't name the site (news.mit.edu is MIT's).
const GENERIC_LABELS = new Set(['www', 'news', 'blog', 'blogs', 'feed', 'feeds', 'rss', 'pub', 'press', 'magazine', 'newsletter']);

const plain = (text) => ({ text, italic: false });
const italic = (text) => ({ text, italic: true });
const endsSentence = (text) => /[.?!]$/.test(text);
const sentence = (text) => (endsSentence(text) ? text : `${text}.`);

/** The arXiv ID in an arXiv link (abs, pdf or html; the version dropped), else null. */
export function arxivId(link) {
  return (typeof link === 'string' && link.match(ARXIV_ID)?.[1]) || null;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

// example.com, or example.co.uk: the part of a host a site owns.
function registrableDomain(host) {
  const labels = host.split('.');
  const country = labels.length > 2 && labels.at(-1).length === 2 && labels.at(-2).length <= 3;
  return labels.slice(country ? -3 : -2).join('.');
}

// Whether a piece of the feed's title names the article's host ("Crunchbase News", news.crunchbase.com).
function namesHost(part, host) {
  const name = squash(part);
  const labels = host.split('.').slice(0, -1).map((label) => label.replace(/-/g, ''))
    .filter((label) => label.length >= 3 && !GENERIC_LABELS.has(label));
  return name.length >= 3 && labels.some((label) => name.includes(label) || label.includes(name));
}

// Whether the article is on another site than its feed's: the feed is an
// aggregator such as Hacker News. Unknown when either host is missing.
function linksElsewhere(host, siteUrl) {
  const siteHost = hostOf(siteUrl);
  if (!host || !siteHost) return false;
  return registrableDomain(host) !== registrableDomain(siteHost);
}

/**
 * The site the article was published on: the feed's title without its
 * tagline, or the article's host when the feed links elsewhere (Hacker News,
 * Lobsters) or has no title.
 */
export function siteName({ siteName: title, siteUrl, link }) {
  const host = hostOf(link);
  if (linksElsewhere(host, siteUrl)) return host;
  const parts = oneLine(title).split(TAGLINE).filter(Boolean);
  return parts.find((part) => namesHost(part, host)) ?? parts[0] ?? host;
}

// (2026, October 21), (2026) for a preprint, or (n.d.). Dates are UTC, as stored.
function apaDate(value, yearOnly) {
  const date = value ? new Date(value) : null;
  if (!(date?.getTime() > 0)) return '(n.d.).';
  const year = date.getUTCFullYear();
  return yearOnly ? `(${year}).` : `(${year}, ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}).`;
}

// The reference's elements in APA order; a work with no author starts with its title.
function inOrder({ author, date, title, source, url }) {
  const elements = author ? [author, date, title, source, url] : [title, date, source, url];
  return elements.filter((element) => element?.length).flatMap((element, i) => (i ? [plain(' '), ...element] : element));
}

// Adjacent runs in the same style become one.
const merged = (runs) => runs.reduce((out, run) => {
  const last = out.at(-1);
  if (last && last.italic === run.italic) last.text += run.text;
  else if (run.text) out.push({ ...run });
  return out;
}, []);

function articleParts({ title, site, authors }) {
  const sameAsAuthor = authors.length === 1 && sameName(authors[0], site);
  return {
    title: [plain(sentence(title))],
    source: site && !sameAsAuthor ? [italic(site), plain(endsSentence(site) ? '' : '.')] : null,
  };
}

function preprintParts({ title, id }) {
  return {
    title: [italic(title.replace(/\.$/, '')), plain(` (arXiv:${id}).`)],
    source: [plain('arXiv.')],
  };
}

/**
 * An article's APA 7 reference as runs ({ text, italic }). source: { author,
 * publishedAt, title, link, siteName (the feed's title), siteUrl (the feed's
 * site, to spot aggregators) }; any of them may be missing.
 */
export function apaCitation(source) {
  const id = arxivId(source.link);
  const site = id ? 'arXiv' : siteName(source);
  const authors = apaAuthors(source.author, site);
  const title = oneLine(decodeLatex(oneLine(source.title))) || '[Untitled]';
  const parts = id ? preprintParts({ title, id }) : articleParts({ title, site, authors });
  const url = id ? `https://arxiv.org/abs/${id}` : withoutTracking(oneLine(source.link));
  return merged(inOrder({
    ...parts,
    author: authors.length ? [plain(sentence(apaAuthorList(authors)))] : null,
    date: [plain(apaDate(source.publishedAt, Boolean(id)))],
    url: url ? [plain(url)] : null,
  }));
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (text) => text.replace(/[&<>"]/g, (c) => HTML_ESCAPES[c]);

/** The reference as plain text (no italics). */
export const citationText = (runs) => runs.map((run) => run.text).join('');

/** The reference as Markdown, italics as *…* (with \, * and _ inside them escaped). */
export const citationMarkdown = (runs) => runs.map((run) => (run.italic ? `*${run.text.replace(/[\\*_]/g, '\\$&')}*` : run.text)).join('');

/** The reference as HTML, italics as <i>, for pasting into a word processor. */
export const citationHtml = (runs) => runs.map((run) => (run.italic ? `<i>${escapeHtml(run.text)}</i>` : escapeHtml(run.text))).join('');

// Reference lists are alphabetical by their first word, ignoring a leading A, An or The.
const sortKey = (runs) => citationText(runs).toLowerCase().replace(/^(?:the|an?)\s+/, '');

/** References for several sources, in reference-list (alphabetical) order. */
export function apaReferences(sources) {
  return sources.map(apaCitation).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

/** A reference list as text or Markdown: one reference per paragraph. */
export const referencesText = (list) => list.map(citationText).join('\n\n');
export const referencesMarkdown = (list) => list.map(citationMarkdown).join('\n\n');

/** A reference list as HTML paragraphs with APA's hanging indent. */
export const referencesHtml = (list) => list
  .map((runs) => `<p style="margin:0 0 0 0.5in;text-indent:-0.5in">${citationHtml(runs)}</p>`)
  .join('');
