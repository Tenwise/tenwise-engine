import { useCallback, useEffect, useState } from 'react';
import { fetchOllamaStatus, startOllama, streamModelPull } from '../../utils/api.js';

const POLL_MS = 5000;

export const pullPercent = (chunk) => (chunk.total > 0 ? Math.round((chunk.completed / chunk.total) * 100) : 0);

/**
 * Ollama install/run status (polled every 5 s so the UI advances once it
 * starts), plus start and model-pull actions with progress.
 */
export function useOllamaStatus(onReady) {
  const [status, setStatus] = useState(null); // null = still checking
  const [starting, setStarting] = useState(false);
  const [pulling, setPulling] = useState(null);
  const [progress, setProgress] = useState({});
  const [error, setError] = useState(null);

  const check = useCallback(() => fetchOllamaStatus()
    .then((result) => {
      setStatus(result);
      if (result.running && result.models.length > 0) onReady?.(result.models);
    })
    .catch((err) => setError(err.message)), [onReady]);

  useEffect(() => {
    check();
    const interval = setInterval(check, POLL_MS);
    return () => clearInterval(interval);
  }, [check]);

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      await startOllama();
      setTimeout(check, 2500); // give it a moment to boot
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }, [check]);

  const pull = useCallback(async (model) => {
    const report = (entry) => setProgress((p) => ({ ...p, [model]: entry }));
    setPulling(model);
    report({ status: 'Starting…', percent: 0 });
    setError(null);
    try {
      await streamModelPull(model, (chunk) => report({ status: chunk.status || 'pulling', percent: pullPercent(chunk) }));
      await check();
    } catch (err) {
      setError(`Pull failed: ${err.message}`);
    } finally {
      setPulling(null);
    }
  }, [check]);

  return { status, starting, pulling, progress, error, check, start, pull };
}
