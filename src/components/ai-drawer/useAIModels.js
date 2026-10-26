import { useCallback, useEffect, useState } from 'react';
import { fetchAIModels } from '../../utils/api.js';
import { pickDefaultModel } from '../../ai/models.js';

/** Available AI models and the drawer's current selection. */
export function useAIModels() {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);

  const loadModels = useCallback((modelList) => {
    setModels(modelList);
    setSelectedModel((prev) => prev || pickDefaultModel(modelList));
    setReady(modelList.length > 0);
    setChecked(true);
  }, []);

  // Initial check — mark as checked regardless of outcome to avoid a flash.
  useEffect(() => {
    fetchAIModels()
      .then(({ models: list }) => loadModels(list))
      .catch(() => { setReady(false); setChecked(true); });
  }, [loadModels]);

  return { models, selectedModel, setSelectedModel, ready, checked, loadModels };
}
