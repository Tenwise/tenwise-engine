import { citationHtml, citationText, referencesHtml, referencesText } from '../../../shared/citation.js';

// Copies as rich text and plain text together: a word processor pastes the
// HTML (italics and, for a list, APA's hanging indent); a plain-text field
// pastes the text.
async function copyRich(text, html) {
  if (typeof ClipboardItem !== 'function' || !navigator.clipboard?.write) {
    await navigator.clipboard.writeText(text);
    return;
  }
  await navigator.clipboard.write([new ClipboardItem({
    'text/plain': new Blob([text], { type: 'text/plain' }),
    'text/html': new Blob([`<meta charset="utf-8">${html}`], { type: 'text/html' }),
  })]);
}

/** Copies one citation (runs from apaCitation). */
export const copyCitation = (runs) => copyRich(citationText(runs), citationHtml(runs));

/** Copies a reference list (from apaReferences), one reference per paragraph. */
export const copyReferences = (list) => copyRich(referencesText(list), referencesHtml(list));
