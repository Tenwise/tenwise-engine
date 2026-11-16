import { useCallback, useEffect, useState } from 'react';
import { capability } from '../../plugins/index.js';
import { nanoState } from '../../utils/chromeAI.js';

// What to tell people about Gemini Nano in each state (see nanoState()), and
// where it can't run, Ollama instead when this app offers it (capability 'ollama').
const TEXT = {
  ready: 'Built into Chrome · runs on your device',
  downloadable: 'Chrome can run Gemini Nano here but hasn\'t downloaded it yet. It\'s a one-time download of a few gigabytes; Chrome needs about 22 GB free.',
  downloading: 'Chrome is downloading Gemini Nano. AI features start working when it finishes.',
  'unsupported-device': 'Chrome can\'t run Gemini Nano on this computer. It needs about 22 GB of free disk space and either a GPU with more than 4 GB of video memory or 16 GB of RAM; chrome://on-device-internals shows the reason.',
  'old-chrome': 'Gemini Nano needs Google Chrome 148 or later. Update Chrome (Chrome menu → Help → About Google Chrome)',
  'not-chrome': 'Gemini Nano is built into desktop Google Chrome (148+). Open Tenwise in Chrome',
};
const OLLAMA_INSTEAD = { 'unsupported-device': ' Ollama works instead.', 'old-chrome': ', or use Ollama.', 'not-chrome': ', or use Ollama.' };
const PLAIN_END = { 'old-chrome': '.', 'not-chrome': '.' };

/** The text for Gemini Nano's state. */
export function nanoText(state) {
  const end = capability('ollama') ? OLLAMA_INSTEAD[state] : PLAIN_END[state];
  return TEXT[state] + (end ?? '');
}

/** Gemini Nano's state (null while checking), and a way to check again. */
export function useNanoState() {
  const [state, setState] = useState(null);
  const refresh = useCallback(() => nanoState().then(setState), []);
  useEffect(() => { refresh(); }, [refresh]);
  return [state, refresh];
}

