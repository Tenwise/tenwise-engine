// Generates the experiment's newsletters with the app's own newsletter path
// (prepareMultiArticleRequest + collectResponse, so Gemini Nano in this
// Chrome) and saves each to Studio on the server this dev page talks to.
// Run from the console: await window.generateCorpus().
import { prepareMultiArticleRequest } from '../../src/ai/multiArticle.js';
import { collectResponse } from '../../src/ai/tasks.js';
import { newsletterItem } from '../../src/components/multi-article/studioItem.js';
import { createStudioItem, fetchArticlePage, fetchFeeds } from '../../src/utils/api.js';

const AI_KEY = 'tenwise-ai-settings';
const PERSONA = {
  personas: ['executive', 'philosopher', 'teacher'],
  tone: { voice: 'sharp', energy: 'reflective', angle: 'provocative' },
  customInstructions: 'Summarize the facts first, plainly. Then add one short Adlerian read: whose task this is (who bears the consequence), what goal an actor\'s stated cause may serve, and any competition, blame or status-seeking driving it. No outrage, praise or blame.',
};
const DEFAULT = { personas: ['analyst'], tone: { voice: 'neutral', energy: 'enthusiastic', angle: 'optimistic' }, customInstructions: '' };

// id, style, folder, how many articles, persona or default settings.
export const PLAN = [
  { id: 'c1', style: 'digest', folder: 'AI News', count: 6, persona: true },
  { id: 'c2', style: 'digest', folder: 'Technology', count: 8, persona: false },
  { id: 'c3', style: 'roundup', folder: 'Philosophy and Ideas', count: 5, persona: true },
  { id: 'c4', style: 'roundup', folder: 'Engineering', count: 6, persona: false },
  { id: 'c5', style: 'brief', folder: 'Technology', count: 5, persona: false, offset: 20 },
  { id: 'c6', style: 'brief', folder: 'Engineering', count: 4, persona: true, offset: 10 },
  { id: 'c7', style: 'digest', folder: 'all', count: 10, persona: false, offset: 40 },
  { id: 'c8', style: 'roundup', folder: 'AI News', count: 4, persona: false, offset: 15 },
];

const log = (line) => { document.getElementById('log').textContent += `${line}\n`; console.log(line); };

async function articlesFor(entry, folders, feedTitles) {
  const view = entry.folder === 'all' ? ['all', undefined] : ['folder', folders[entry.folder]];
  const page = await fetchArticlePage(view[0], view[1], { offset: entry.offset || 0, limit: entry.count });
  return page.articles.map((a) => ({ ...a, feedTitle: feedTitles.get(a.feedId) }));
}

async function generateOne(entry, folders, feedTitles) {
  const articles = await articlesFor(entry, folders, feedTitles);
  localStorage.setItem(AI_KEY, JSON.stringify(entry.persona ? PERSONA : DEFAULT));
  const started = performance.now();
  const { model, messages, notice } = await prepareMultiArticleRequest({ operation: 'newsletter', template: entry.style, instructions: '', articles });
  const output = await collectResponse(model, messages);
  const seconds = Math.round((performance.now() - started) / 1000);
  const item = newsletterItem({ output, style: entry.style, model, aiSettings: entry.persona ? PERSONA : DEFAULT, articles });
  item.title = `[${entry.id}] ${item.title}`.slice(0, 200);
  const saved = await createStudioItem(item);
  return { id: entry.id, studioId: saved.id, seconds, chars: output.length, notice };
}

window.generateCorpus = async (only) => {
  const before = localStorage.getItem(AI_KEY);
  const feeds = await fetchFeeds();
  const feedTitles = new Map(feeds.map((f) => [f.id, f.title]));
  const folders = Object.fromEntries((await (await fetch('/api/reader/folders')).json()).map((f) => [f.name, f.id]));
  const results = [];
  try {
    for (const entry of PLAN.filter((e) => !only || only.includes(e.id))) {
      log(`${entry.id}: generating ${entry.style} from ${entry.count} ${entry.folder} articles…`);
      try {
        const r = await generateOne(entry, folders, feedTitles);
        results.push(r);
        log(`${entry.id}: saved as Studio #${r.studioId} (${r.chars} chars, ${r.seconds}s)${r.notice ? ` – ${r.notice}` : ''}`);
      } catch (err) {
        results.push({ id: entry.id, error: err.message });
        log(`${entry.id}: FAILED ${err.message}`);
      }
    }
  } finally {
    if (before === null) localStorage.removeItem(AI_KEY); else localStorage.setItem(AI_KEY, before);
  }
  window.corpusResults = results;
  return results;
};
log('Ready. Run: await generateCorpus()');
