import { useCallback, useState } from 'react';
import { fetchAIModels } from '../utils/api.js';
import { usePolling } from './usePolling.js';

/** The AI models available now (Gemini Nano, Ollama), checked every 30 s; null until the first answer. */
export function useAvailableModels() {
  const [models, setModels] = useState(null);
  const load = useCallback(() => fetchAIModels().then(({ models: m }) => setModels(m)).catch(() => {}), []);
  usePolling(load, 30_000);
  return models;
}
