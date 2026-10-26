import { useCallback, useEffect, useState } from 'react';
import { nanoState } from '../../utils/chromeAI.js';

// What to tell people about Gemini Nano in each state (see nanoState()).
export const NANO_TEXT = {
  ready: 'Built into Chrome · runs on your device',
  downloadable: 'Chrome can run Gemini Nano here but hasn\'t downloaded it yet. It\'s a one-time download of a few gigabytes; Chrome needs about 22 GB free.',
  downloading: 'Chrome is downloading Gemini Nano. AI features start working when it finishes.',
  'unsupported-device': 'Chrome can\'t run Gemini Nano on this computer. It needs about 22 GB of free disk space and either a GPU with more than 4 GB of video memory or 16 GB of RAM; chrome://on-device-internals shows the reason. Ollama works instead.',
  'old-chrome': 'Gemini Nano needs Google Chrome 148 or later. Update Chrome (Chrome menu → Help → About Google Chrome), or use Ollama.',
  'not-chrome': 'Gemini Nano is built into desktop Google Chrome (148+). Open Tenwise in Chrome, or use Ollama.',
};

/** Gemini Nano's state (null while checking), and a way to check again. */
export function useNanoState() {
  const [state, setState] = useState(null);
  const refresh = useCallback(() => nanoState().then(setState), []);
  useEffect(() => { refresh(); }, [refresh]);
  return [state, refresh];
}

