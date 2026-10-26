// The author element of an APA 7 reference, from a feed item's author field.
// Feeds send one free-text string, and it is messy: "Ada Lovelace", "A, B,
// and C", "staff@site.com (Name)", arXiv's LaTeX accents ("Sch\"utze"), MIT
// News' "Name | Department", Lobsters' "site.com via user", credentials
// ("Name, PhD"), the outlet after the names ("Name, Ars Technica"), or junk
// ("[object Object]"). A name that reads as a person becomes "Surname, I. I.";
// anything else (a group, a handle) is kept as written, which is what APA
// does with group authors and is the safe way to be wrong.

const ACCENT_MARKS = {
  '"': '̈', "'": '́', '`': '̀', '^': '̂', '~': '̃', '=': '̄', '.': '̇',
  c: '̧', v: '̌', u: '̆', H: '̋', k: '̨', r: '̊',
};
const LATEX_LETTERS = { L: 'Ł', l: 'ł', O: 'Ø', o: 'ø', ss: 'ß', AE: 'Æ', ae: 'æ', OE: 'Œ', oe: 'œ', AA: 'Å', aa: 'å', i: 'ı', j: 'ȷ' };
// \"u, \"{u}, {\"u}, \'{\i}: an accent written as a symbol.
const SYMBOL_ACCENT = /\{?\\(["'`^~=.])(?:\{\s*(\\i|[A-Za-z])\s*\}|(\\i|[A-Za-z]))\}?/g;
// \v{c}, {\c c}: an accent written as a letter.
const LETTER_ACCENT = /\{?\\([cvuHkr])(?:\s*\{\s*(\\i|[A-Za-z])\s*\}|\s+([A-Za-z]))\}?/g;
// {\L}, \o{}, \ss: a letter of its own.
const LETTER_COMMAND = /\{\\(ss|AE|ae|OE|oe|AA|aa|[LlOoij])\}|\\(ss|AE|ae|OE|oe|AA|aa|[LlOoij])(?:\{\}|\s+|(?![A-Za-z]))/g;

const accentOn = (base, accent) => `${base === '\\i' ? 'i' : base}${ACCENT_MARKS[accent]}`;

/** Text with LaTeX accents (as arXiv sends names and titles) turned into letters: Sch\"utze → Schütze. */
export function decodeLatex(text) {
  if (!text.includes('\\')) return text;
  return text
    .replace(SYMBOL_ACCENT, (_, accent, braced, bare) => accentOn(braced ?? bare, accent))
    .replace(LETTER_ACCENT, (_, accent, braced, spaced) => accentOn(braced ?? spaced, accent))
    .replace(LETTER_COMMAND, (_, braced, bare) => LATEX_LETTERS[braced ?? bare])
    .normalize('NFC');
}

/** Text on one line: zero-width characters (some feeds fingerprint titles with them) out, whitespace collapsed. */
export const oneLine = (text) => (typeof text === 'string' ? text.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').replace(/\s+/g, ' ').trim() : '');

// Values that name no one.
const JUNK = /^(?:\[object object\]|admin|administrator|unknown|guest author|guest|none|null|undefined|n\/a)$/i;
const isEmail = (text) => /^\S+@\S+$/.test(text);
const isViaLine = (text) => /^\S+\.\S+ via \S+$/i.test(text); // Lobsters: the submitter, not the author

/** The author field as one clean line: no markup, e-mail wrapper, "By" or closing period; '' when it names no one. */
export function cleanAuthorField(raw) {
  if (typeof raw !== 'string') return '';
  const text = oneLine(decodeLatex(raw).split('<')[0].replace(/[{}]/g, ''))
    .replace(/^by\s+/i, '')
    .replace(/^\S+@\S+\s*\((.+)\)$/, '$1')
    .replace(/(\p{Ll})\.$/u, '$1');
  return isEmail(text) || isViaLine(text) || JUNK.test(text) ? '' : text;
}

const PARTICLES = new Set(['van', 'von', 'der', 'den', 'de', 'del', 'della', 'di', 'da', 'dos', 'das', 'du', 'la', 'le', 'ten', 'ter', 'bin', 'ibn', 'al', 'el', 'zu']);
const SUFFIXES = new Map([['jr', 'Jr.'], ['sr', 'Sr.'], ['ii', 'II'], ['iii', 'III'], ['iv', 'IV']]);
const CREDENTIALS = new Set(['phd', 'md', 'mba', 'msc', 'ms', 'ma', 'ba', 'bsc', 'jd', 'psyd', 'edd', 'dphil', 'rn', 'cpa', 'esq', 'mph']);
// Words that mark an organisation, an outlet or a section, not a person.
const ORG_WORDS = /\b(?:institute|university|college|school|department|division|office|laborator(?:y|ies)|labs?|cent(?:er|re)|foundation|society|association|council|committee|agency|inc|llc|ltd|corp(?:oration)?|company|group|team|staff|editors?|editorial|board|press|times|news(?:room)?|journal|magazine|media|review|daily|post|herald|tribune|wire|network|video|podcast|newsletter|blog|community|project)\b/i;

const bare = (token) => token.toLowerCase().replace(/\./g, '');
const isShortCaps = (token) => /^[A-Z]{2,4}$/.test(token); // AI, FT, MIT, NASA
const isNameToken = (token, shouting) => PARTICLES.has(token) || (/^\p{Lu}/u.test(token) && (shouting || !isShortCaps(token)));
const titleCase = (token) => token.charAt(0) + token.slice(1).toLowerCase();

/** Letters only, lower case: how two spellings of one name are compared. */
export const squash = (text) => (text || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Whether two names are the same name (case, spacing and punctuation aside). */
export const sameName = (a, b) => squash(a) !== '' && squash(a) === squash(b);

// The name's words without credentials, and its suffix (Jr., III) if it has one.
function nameWords(name) {
  const words = name.split(' ');
  while (words.length > 2 && CREDENTIALS.has(bare(words.at(-1)))) words.pop();
  const suffix = words.length > 2 ? SUFFIXES.get(bare(words.at(-1))) : undefined;
  return { words: suffix ? words.slice(0, -1) : words, suffix };
}

// Whether the words read as a person's name: two to five capitalised words or
// particles, with nothing that marks a group (AI, Press, a domain, digits).
function readsAsPerson(words, name) {
  if (words.length < 2 || words.length > 5) return false;
  if (ORG_WORDS.test(name) || /[\d@/&+#]/.test(name)) return false;
  if (words.some((word) => /\.\p{L}{2,}/u.test(word))) return false;
  const shouting = words.every((word) => word === word.toUpperCase());
  return words.every((word) => isNameToken(word, shouting));
}

// "Jean-Paul" → "J.-P.", "J.R.R." → "J. R. R."
const initialsOf = (word) => word.split('-')
  .map((part) => part.split('.').filter(Boolean).map((piece) => `${[...piece][0].toUpperCase()}.`).join(' '))
  .join('-');

/**
 * "Ludwig van Beethoven" → "van Beethoven, L.", "Tim De Chant" → "De Chant, T.";
 * null when the name doesn't read as a person's.
 */
export function personName(name) {
  const { words, suffix } = nameWords(name);
  if (!readsAsPerson(words, name)) return null;
  const shouting = words.every((word) => word === word.toUpperCase());
  const cased = shouting ? words.map(titleCase) : words;
  let start = cased.length - 1;
  while (start > 1 && PARTICLES.has(cased[start - 1].toLowerCase())) start -= 1;
  const initials = cased.slice(0, start).filter((word) => !PARTICLES.has(word)).map(initialsOf).join(' ');
  return `${cased.slice(start).join(' ')}, ${initials}${suffix ? `, ${suffix}` : ''}`;
}

// A suffix or credential after a comma ("King, Jr.", "Doe, PhD"), not a given name.
const isNameSuffix = (word) => SUFFIXES.has(bare(word)) || CREDENTIALS.has(bare(word));

// "Smith, John": one comma between two single words is a name written surname first.
function invertedName(text) {
  const match = text.match(/^(\p{Lu}[\p{L}'’-]+),\s*(\p{Lu}[\p{L}.'’-]*)$/u);
  if (!match) return null;
  const [, surname, given] = match;
  if (ORG_WORDS.test(text) || isNameSuffix(given)) return null;
  return `${surname}, ${initialsOf(given)}`;
}

const PIPE = /\s*\|\s*/;
const LIST_SEPARATOR = /\s*;\s*|\s*,\s*(?:(?:and|&)\s+)?|\s+(?:and|&)\s+/i;
const SUFFIX_AFTER_COMMA = /,\s*(jr|sr|ii|iii|iv)\.?(?=,|;|$|\s)/gi;

// The people the field names. "A | B | Department" (MIT News) is judged part
// by part. A list is split at commas, "and", "&" and semicolons, keeping
// ", Jr." with its name, unless its first name isn't a person's: then the
// commas belong to an organisation ("School of Humanities, Arts, and Social
// Sciences"). The outlet after the names ("…, Ars Technica") is not an author.
function peopleIn(text, siteName) {
  if (text.includes('|')) return text.split(PIPE).map(personName).filter(Boolean);
  const names = text.replace(SUFFIX_AFTER_COMMA, ' $1').split(LIST_SEPARATOR).filter(Boolean);
  if (!personName(names[0])) return [];
  return names.filter((name, i) => i === 0 || !sameName(name, siteName)).map(personName).filter(Boolean);
}

/**
 * The authors as APA names ("Lovelace, A."), or [] when the field names no
 * one. The people in the field when it names any (affiliations, credentials
 * and the outlet after the names are dropped; `siteName` helps spot the
 * outlet); otherwise the field as one group author.
 */
export function apaAuthors(raw, siteName = '') {
  const text = cleanAuthorField(raw);
  if (!text) return [];
  const inverted = invertedName(text);
  if (inverted) return [inverted];
  const people = peopleIn(text, siteName);
  return people.length ? people : [text.split(PIPE)[0]];
}

/** APA's author list: "A", "A, & B", "A, B, & C"; past 20, the first 19, ". . ." and the last. */
export function apaAuthorList(names) {
  if (names.length <= 1) return names.join('');
  if (names.length <= 20) return `${names.slice(0, -1).join(', ')}, & ${names.at(-1)}`;
  return `${names.slice(0, 19).join(', ')}, . . . ${names.at(-1)}`;
}
