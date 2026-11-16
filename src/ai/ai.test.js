import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText } from '../utils/helpers.js';
import { buildSystemPrompt } from './voice.js';
import { BASE_SUMMARY, BASE_CHAT } from './prompts.js';
import { articleContext, articleText, usableExtraction } from './context.js';
import { summaryMessages, chatMessages } from './tasks.js';

// ── Legacy reference implementations, copied verbatim from v1.4.0 ──────────
// The AI layer refactor must produce byte-identical prompts.
/* eslint-disable */
const LEGACY = (() => {
const BASE_SUMMARY = `You are an editorial reading assistant. Read the article and write a concise, insightful summary in 3–4 sentences. Focus on the key finding or argument, why it matters, and one concrete takeaway. Write in plain prose, no bullet points. Do not start with "This article".`;
const BASE_CHAT = `You are a reading assistant. Answer questions about the article clearly and concisely. Stay grounded in the article content. If something is not covered in the article, say so briefly.`;
function legacyArticleContext(article, extractedContent) {
  const content = htmlToText(extractedContent || article?.content || article?.summary || '');
  const truncated = content.length > 6000 ? content.slice(0, 6000) + '…' : content;
  return `Title: ${article?.title || 'Unknown'}
Author: ${article?.author || 'Unknown'}
Published: ${article?.publishedAt ? new Date(article.publishedAt).toDateString() : 'Unknown'}

${truncated}`;
}

  return { BASE_SUMMARY, BASE_CHAT, legacyArticleContext };
})();
/* eslint-enable */

// AI-13 changed one sentence of the summary instruction; the rest is still v1.4.0.
const AI13 = (text) => text
  .replace('Do not start with "This article".', 'Lead with the finding itself; don\'t refer to "the article", "this article" or "the piece".')
  .replace("Do not start with 'This article'.", "Lead with the finding itself; don't refer to 'the article' or 'this article'.");
for (const [k, v] of Object.entries(LEGACY)) if (typeof v === 'string') LEGACY[k] = AI13(v);


// What a voice plugin adds after a system prompt (voice.js).
const VOICE = '\n\nTone: Be brief.';
const article = {
  id: 1, title: 'Cloud costs', author: 'A. Writer', publishedAt: '2026-10-01T10:00:00Z', link: 'https://e.com/a', feedTitle: 'Infra Weekly',
  content: `<p>${'Body text. '.repeat(900)}</p>`, summary: '<p>Short summary</p>',
};

test('prompts are byte-identical to v1.4.0', () => {
  assert.equal(BASE_SUMMARY, LEGACY.BASE_SUMMARY);
  assert.equal(BASE_CHAT, LEGACY.BASE_CHAT);
});

test('single-article messages match v1.4.0', () => {
  // An extraction at least as long as the feed's text is used as before (AI-11).
  const extracted = `<article>${'Extracted full text. '.repeat(500)}</article>`;
  for (const ex of [undefined, extracted]) {
    const ctx = LEGACY.legacyArticleContext(article, ex);
    assert.equal(articleContext(article, ex), ctx);
    assert.deepEqual(summaryMessages(article, ex, VOICE), [
      { role: 'system', content: buildSystemPrompt(LEGACY.BASE_SUMMARY, VOICE) },
      { role: 'user', content: ctx },
    ]);
    const history = [{ role: 'user', content: 'Why?' }];
    assert.deepEqual(chatMessages(article, ex, history, VOICE), [
      { role: 'system', content: `${buildSystemPrompt(LEGACY.BASE_CHAT, VOICE)}\n\nARTICLE:\n${ctx}` },
      ...history,
    ]);
  }
});

test('without a voice plugin, prompts go as written', () => {
  assert.equal(summaryMessages(article)[0].content, LEGACY.BASE_SUMMARY);
});


// AI-11: a GitHub Blog page whose extraction was the author box and related
// links, while the feed had the whole article.
test('a page extraction much shorter than the feed text is not used (AI-11)', () => {
  const feedArticle = { title: 'Game Off 2026', content: `<p>${'The jam runs all November and the theme is SHIFT. '.repeat(150)}</p>` };
  const authorBox = '<div>Written by Senior Program Manager. Related posts Highlights from Git 2.56.</div>';
  assert.equal(usableExtraction(authorBox, feedArticle), null);
  assert.match(articleText(feedArticle, authorBox), /theme is SHIFT/);
  assert.doesNotMatch(articleContext(feedArticle, authorBox), /Related posts/);
});

test('a full extraction is used, and any extraction beats a stub feed (AI-11)', () => {
  const longFeed = { content: `<p>${'Feed text. '.repeat(200)}</p>` };
  const fullPage = `<article>${'Page text. '.repeat(200)}</article>`;
  assert.equal(usableExtraction(fullPage, longFeed), fullPage);
  const stub = { content: '<a href="https://lobste.rs/s/x">Comments</a>' };
  assert.equal(usableExtraction('<p>Short page.</p>', stub), '<p>Short page.</p>');
  assert.equal(usableExtraction(null, stub), null);
});
