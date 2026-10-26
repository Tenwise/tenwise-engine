import { getNanoModel, isNanoModel, streamNanoChat } from './chromeAI.js';
import { serverStatus } from '../app/serverStatus.js';
import { withoutThinking } from '../ai/thinking.js';

const API_BASE = '/api';
export const UNREACHABLE = "Can't reach the Tenwise server";
// What Vite's proxy answers, with an empty body, when the API isn't running.
const GATEWAY = new Set([502, 503, 504]);

async function fetchOrUnreachable(url, opts) {
  try {
    return await fetch(url, opts);
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') throw err;
    serverStatus.reportFailure();
    throw new Error(UNREACHABLE, { cause: err });
  }
}

// Sends a request; on failure throws the server's error message, or `fallback`,
// with the error body as `details`. A failure without a message (no answer, or
// the proxy's empty 502) may mean the server is gone, so serverStatus checks.
export async function send(path, fallback, opts = {}) {
  const res = await fetchOrUnreachable(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (!err.error && res.status >= 500) serverStatus.reportFailure();
    throw Object.assign(new Error(err.error || (GATEWAY.has(res.status) ? UNREACHABLE : fallback)), { details: err });
  }
  return res;
}

// Like send(), resolving to the parsed JSON body. send, request and json are
// exported for plugins (src/plugins), which talk to their own routes.
export async function request(path, fallback, opts) {
  return (await send(path, fallback, opts)).json();
}

export function json(body, method = 'POST') {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

// ── Ollama management ────────────────────────────────────────────────────────

export async function fetchOllamaStatus() {
  return request('/ollama/status', 'Could not reach server'); // { installed, running, models[] }
}

export async function startOllama() {
  return request('/ollama/start', 'Failed to start Ollama', { method: 'POST' });
}

/**
 * Streams ollama pull progress. Calls onProgress({ status, completed, total }) for each chunk.
 * @param {string} model
 * @param {(progress: object) => void} onProgress
 */
export async function streamModelPull(model, onProgress) {
  const res = await send('/ollama/pull', 'Pull request failed', json({ model }));
  for await (const chunk of readNdjson(res.body)) {
    if (chunk.error) throw new Error(chunk.error);
    onProgress(chunk);
    if (chunk.status === 'success') return;
  }
}

// ── Feeds and articles from the web ──────────────────────────────────────────

export async function parseFeed(url) {
  return request('/feeds/parse', 'Failed to parse feed', json({ url }));
}

export async function discoverFeeds(url) {
  return request('/discover', 'Failed to discover feeds', json({ url }));
}

export async function extractArticle(url, signal) {
  return request('/articles/extract', 'Failed to extract article', { ...json({ url }), signal });
}

// ── Summaries ────────────────────────────────────────────────────────────────

export async function saveSummary(data) {
  return request('/summaries', 'Failed to save summary', json(data));
}

export async function fetchSummaries() {
  return request('/summaries', 'Failed to fetch summaries');
}

export async function deleteSummary(id) {
  return request(`/summaries/${id}`, 'Failed to delete summary', { method: 'DELETE' });
}

export function getSummariesExportURL() {
  return `${API_BASE}/summaries/export`;
}

export async function fetchDBPath() {
  return request('/summaries/db-path', 'Failed to get DB path');
}

// ── Collections ──────────────────────────────────────────────────────────────
// Named groups of saved articles; an article can be in several.

export async function fetchCollections() { return request('/collections', 'Failed to load collections'); }
export async function fetchArticleCollections(articleId) {
  return request(`/collections/of/${articleId}`, 'Failed to load the article’s collections');
}
export async function createCollection(data) { return request('/collections', 'Failed to create the collection', json(data)); }
export async function updateCollection(id, changes) {
  return request(`/collections/${id}`, 'Failed to update the collection', json(changes, 'PUT'));
}
export async function deleteCollection(id) {
  return request(`/collections/${id}`, 'Failed to delete the collection', { method: 'DELETE' });
}
export async function addToCollection(id, articleIds) {
  return request(`/collections/${id}/add`, 'Failed to add to the collection', json({ articleIds }));
}
export async function removeFromCollection(id, articleIds) {
  return request(`/collections/${id}/remove`, 'Failed to remove from the collection', json({ articleIds }));
}
/** URL of a collection's articles as one Markdown file (downloads; for NotebookLM). */
export function getCollectionExportURL(id) { return `${API_BASE}/collections/${id}/export.md`; }

// ── Highlights ───────────────────────────────────────────────────────────────

export async function saveHighlight(data) {
  return request('/highlights', 'Failed to save highlight', json(data));
}

export async function fetchHighlights() {
  return request('/highlights', 'Failed to fetch highlights');
}

export async function fetchHighlightsByArticle(articleUrl) {
  return request(`/highlights/by-article?url=${encodeURIComponent(articleUrl)}`, 'Failed to fetch article highlights');
}

export async function fetchHighlightsCount() {
  return request('/highlights/count', 'Failed to fetch highlights count');
}

export async function deleteHighlight(id) {
  return request(`/highlights/${id}`, 'Failed to delete highlight', { method: 'DELETE' });
}

export function getHighlightsExportURL() {
  return `${API_BASE}/highlights/export`;
}

export async function fetchHighlightsDBPath() {
  return request('/highlights/db-path', 'Failed to get highlights DB path');
}

// ── Settings (data/settings.json) ─────────────────────────────────────────────

/** { values, path }: the settings saved on the server. */
export async function fetchSettings(signal) {
  return request('/settings', 'Failed to load settings', { signal });
}

/** Saves { key: string | null } changes (null removes); resolves to { values }. */
export async function saveSettings(values) {
  return request('/settings', 'Failed to save settings', json({ values }, 'PUT'));
}

// ── Reader storage (folders, feeds, articles) ─────────────────────────────────

function readerFetch(path, opts) {
  return request(`/reader${path}`, 'Request failed', opts);
}

// Folders
export async function fetchFolders() { return readerFetch('/folders'); }
export async function createFolder(data) { return readerFetch('/folders', json(data)); }
export async function findOrCreateFolder(name) { return readerFetch('/folders/find-or-create', json({ name })); }
export async function updateFolder(id, data) { return readerFetch(`/folders/${id}`, json(data, 'PUT')); }
export async function deleteFolder(id, withFeeds = false) {
  return readerFetch(`/folders/${id}${withFeeds ? '?withFeeds=true' : ''}`, { method: 'DELETE' });
}

// Feeds
export async function fetchFeeds() { return readerFetch('/feeds'); }
/** Removed feeds kept for their saved articles (their names label those saves). */
export async function fetchRemovedFeeds() { return readerFetch('/feeds?removed=1'); }
export async function fetchFeed(id) { return readerFetch(`/feeds/${id}`); }
export async function storeFeed(data) { return readerFetch('/feeds', json(data)); }
export async function patchFeed(id, data) { return readerFetch(`/feeds/${id}`, json(data, 'PUT')); }
export async function removeFeed(id) { return readerFetch(`/feeds/${id}`, { method: 'DELETE' }); }

// Refreshing: the server fetches feeds on its own schedule; these ask it to now.
/** Refreshes one feed: { inserted, failed, feed }. */
export async function refreshFeedNow(id) {
  return request(`/refresh/feeds/${id}`, 'Failed to refresh feed', { method: 'POST' });
}
/** Refreshes every feed, or only `feedIds`: { inserted, failed: [feed titles] }. */
export async function refreshFeeds(feedIds) {
  return request('/refresh', 'Failed to refresh feeds', json(feedIds ? { feedIds } : {}));
}
/** The scheduled refreshes: { running, lastStartedAt, lastFinishedAt, lastInserted, lastFailed }. */
export async function fetchRefreshStatus() { return request('/refresh', 'Failed to check for new articles'); }

// Articles
/**
 * One page of a view's articles: { articles, total, unread, facets, nextOffset }.
 * options: { q, filters: { sentiment, … }, aiOnly, offset, limit }.
 */
export async function fetchArticlePage(view = 'all', id, { q, filters = {}, aiOnly, offset = 0, limit } = {}) {
  const fields = { view, id, offset, q, aiOnly: aiOnly ? '1' : '', limit, ...filters };
  const set = Object.entries(fields).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return readerFetch(`/articles/page?${new URLSearchParams(set.map(([k, v]) => [k, String(v)]))}`);
}
export async function markViewRead(view, id) {
  return readerFetch('/articles/mark-view-read', json({ view, id }));
}
export async function fetchArticle(id) { return readerFetch(`/articles/${id}`); }

// List items omit article bodies; load full articles for any that lack one.
export async function withFullContent(articles) {
  return Promise.all(articles.map((a) => ('content' in a ? a : fetchArticle(a.id).catch(() => a))));
}
export async function fetchArticleByLink(url) {
  return readerFetch(`/articles/by-link?url=${encodeURIComponent(url)}`);
}
export async function patchArticle(id, data) {
  return readerFetch(`/articles/${id}`, json(data, 'PUT'));
}
export async function bulkUpdateArticles(ids, data) {
  return readerFetch('/articles/bulk-update', json({ ids, ...data }, 'PUT'));
}
export async function bulkInsertArticles(feedId, articles) {
  return readerFetch('/articles/bulk-insert', json({ feedId, articles }));
}
export async function fetchArticlesByAiStatus(status) {
  const s = Array.isArray(status) ? status.join(',') : status;
  return readerFetch(`/articles/by-ai-status?status=${encodeURIComponent(s)}`);
}
export async function fetchQueueCount() {
  const { count } = await readerFetch('/articles/queue-count');
  return count;
}
/** Claims the newest queued article for this tab: { article, queued } or { article: null }. */
export async function claimNextQueued() {
  return readerFetch('/articles/claim-next', { method: 'POST' });
}
export async function resetProcessingArticles() {
  return readerFetch('/articles/reset-processing', { method: 'POST' });
}
export async function fetchCounts() { return readerFetch('/articles/counts'); }
export async function clearAllData() { return readerFetch('/all', { method: 'DELETE' }); }

// Installed Ollama models, or null when the server is unreachable.
// (Ollama itself being absent is a normal empty list.)
async function fetchOllamaModels() {
  try {
    const res = await fetch(`${API_BASE}/ai/models`);
    return res.ok ? (await res.json()).models || [] : null;
  } catch {
    return null;
  }
}

export async function fetchAIModels() {
  const [ollamaModels, nano] = await Promise.all([fetchOllamaModels(), getNanoModel()]);
  if (!ollamaModels && !nano) throw new Error('Could not reach the server');
  // Gemini Nano first: it's the default engine; Ollama models are optional extras.
  const models = nano ? [nano, ...(ollamaModels || [])] : ollamaModels;
  return { models }; // { models: [{name, family, parameterSize, size}] }
}

/**
 * Streams a chat completion from Gemini Nano in the browser when that model
 * is selected, otherwise from Ollama via the local proxy.
 * Yields string tokens as they arrive.
 * @param {string} model
 * @param {{role:string, content:string}[]} messages
 * @returns {AsyncGenerator<string>}
 */
export function streamChat(model, messages, signal) {
  return isNanoModel(model) ? streamNanoChat(messages, signal) : streamOllamaChat(model, messages, signal);
}

async function* ollamaContent(body) {
  for await (const chunk of readNdjson(body)) {
    if (chunk.message?.content) yield chunk.message.content;
    if (chunk.done) return;
  }
}

// The answer text only: a reasoning model's <think> block (older Ollama
// versions put it in the content) is dropped.
async function* streamOllamaChat(model, messages, signal) {
  const res = await send('/ai/chat', 'AI request failed', { ...json({ model, messages, stream: true }), signal });
  yield* withoutThinking(ollamaContent(res.body));
}

// Parses a newline-delimited JSON stream, skipping blank or malformed lines.
// Stopping early (break, return, an error) cancels the body, which closes the
// connection so the server stops generating.
async function* readNdjson(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep any incomplete trailing line
      yield* parseLines(lines);
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

function* parseLines(lines) {
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line);
    } catch {
      // ignore malformed chunks
    }
  }
}
