import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText } from '../utils/helpers.js';
import { buildSystemPrompt } from './voice.js';
import { BASE_SUMMARY, BASE_CHAT } from './prompts.js';
import { articleContext } from './context.js';
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
  const extracted = '<article>Extracted full text</article>';
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

