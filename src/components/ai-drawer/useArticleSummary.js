import { useCallback, useState } from 'react';
import { patchArticle, saveSummary } from '../../utils/api.js';
import { streamTokens, summaryMessages } from '../../ai/tasks.js';
import { voiceRecord } from '../../ai/voice.js';
import { useStreamRun, whileCurrent } from '../../hooks/useStreamRun.js';
import { useArticleFieldSync } from './useArticleFieldSync.js';

const orNull = (fields) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v || null]));

// Library record for a saved summary: article metadata, the model, and the
// voice it was written in (voice.js).
function summaryRecord(article = {}, feedTitle, summary, model) {
  return {
    ...orNull({
      article_title: article.title,
      article_url: article.link,
      article_author: article.author,
      article_source: feedTitle,
      article_published_at: article.publishedAt,
    }),
    ...voiceRecord(),
    summary_text: summary,
    ai_model: model,
  };
}

const copyWithLink = (summary, link) => navigator.clipboard.writeText(`${summary}\n\nRead more: ${link || ''}`);

// The article's stored summary, and whether background batch processing wrote
// it (a summary generated here is stored as 'manual' and never replaced by it).
const fromArticle = (article) => ({ summary: article?.aiSummary || '', isBatchSummary: Boolean(article?.aiSummary) && article?.aiSummarySource !== 'manual' });
const fresh = () => ({ summary: '', isBatchSummary: false });
const canGenerate = (article, model) => Boolean(article && model);
// Best effort: the summary is on screen either way.
const storeManualSummary = (id, summary) => patchArticle(id, { aiSummary: summary, aiSummarySource: 'manual' }).catch(() => {});

/** Summary text: generated on demand, or a background batch summary as it lands. */
function useSummaryGeneration({ article, extractedContent, model, onArticleChange }) {
  const [text, setText] = useState(() => fromArticle(article));
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState(null);
  const streamRun = useStreamRun();

  useArticleFieldSync(article, 'aiSummary', {
    onArticleChange: () => {
      streamRun.cancel(); // a summary still streaming belongs to the previous article
      setText(fromArticle(article));
      setError(null);
      setSummarizing(false);
      onArticleChange();
    },
    onFieldChange: (stored) => stored && !summarizing && setText(fromArticle(article)),
  });

  const appendToken = useCallback((token) => setText((t) => ({ ...t, summary: t.summary + token })), []);

  const generate = useCallback(async () => {
    if (summarizing || !canGenerate(article, model)) return;
    setSummarizing(true);
    setText(fresh());
    setError(null);
    const signal = streamRun.start();
    const messages = summaryMessages(article, extractedContent);
    let full = '';
    const collect = (token) => { full += token; appendToken(token); };
    try {
      await streamTokens(model, messages, whileCurrent(signal, collect), signal);
      // A finished summary is stored as the reader's own, so the batch keeps it.
      if (!signal.aborted && full.trim()) await storeManualSummary(article.id, full);
    } catch (err) {
      whileCurrent(signal, (e) => setError(e.message))(err);
    }
    whileCurrent(signal, setSummarizing)(false);
  }, [article, extractedContent, model, summarizing, appendToken, streamRun]);

  const stop = useCallback(() => {
    streamRun.cancel();
    setSummarizing(false);
  }, [streamRun]);

  return { ...text, summarizing, error, generate, stop };
}

/** Summary tab: generation plus copy and save to library. */
export function useArticleSummary({ article, extractedContent, model, feedTitle, onSummarySaved }) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const generation = useSummaryGeneration({ article, extractedContent, model, onArticleChange: () => setSaved(false) });
  const { summary } = generation;

  const copy = useCallback(() => {
    if (!summary) return;
    copyWithLink(summary, article?.link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [summary, article]);

  const save = useCallback(async () => {
    if (saving) return;
    if (!summary) return;
    setSaving(true);
    try {
      await saveSummary(summaryRecord(article ?? undefined, feedTitle, summary, model));
      setSaved(true);
      onSummarySaved?.();
    } catch (err) {
      console.error('Failed to save summary:', err);
    } finally {
      setSaving(false);
    }
  }, [summary, saving, article, feedTitle, model, onSummarySaved]);

  return { ...generation, copied, saving, saved, copy, save };
}
