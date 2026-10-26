import { useEffect, useState } from 'react';
import * as api from '../../utils/api.js';
import { useOnKeyChange } from '../../hooks/useOnKeyChange.js';

// Records a failed extraction: its message, and the server's { reason, site }.
// An abort (the article changed) is not a failure.
function recordFailure(err, setError, setFailure) {
  if (err.name === 'AbortError') return;
  setError(err.message);
  setFailure(err.details ?? {});
}

/**
 * Full-text extraction from the source URL; aborted when the article changes.
 * `settled` turns true once the content shown will no longer change: the
 * extraction finished or failed, or there is no link to extract from.
 * `failure` is the server's { reason, site } when it failed.
 */
export function useArticleExtraction(articleId, link) {
  const [content, setContent] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [failure, setFailure] = useState(null);
  const [finished, setFinished] = useState(false);

  useOnKeyChange(articleId, () => {
    setContent(null);
    setError(null);
    setFailure(null);
    setExtracting(false);
    setFinished(false);
  });

  useEffect(() => {
    if (!link) return undefined;
    const controller = new AbortController();
    const run = async () => {
      setExtracting(true);
      try {
        const data = await api.extractArticle(link, controller.signal);
        if (data.content) setContent(data.content);
      } catch (err) {
        recordFailure(err, setError, setFailure);
      } finally {
        if (!controller.signal.aborted) {
          setExtracting(false);
          setFinished(true);
        }
      }
    };
    run();
    return () => controller.abort();
  }, [articleId, link]);

  return { content, extracting, error, failure, settled: finished || !link };
}
