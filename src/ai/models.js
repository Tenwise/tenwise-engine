import { isNanoModel } from '../utils/chromeAI.js';

// Choosing a model when the user hasn't ("Auto"), the same way in the AI rail
// and for background processing: Gemini Nano once Chrome has downloaded it;
// otherwise the best installed Ollama chat model; Nano that still has to be
// downloaded only when nothing else is installed (Chrome starts that download
// only from a click, so background processing can't).

// Families that write good summaries and analysis, best first. Reasoning
// families come last: Tenwise asks Ollama not to think, but they are
// slower when an Ollama can't turn it off.
const PREFERRED_FAMILIES = ['gemma', 'qwen', 'llama', 'mistral', 'phi', 'deepseek'];

const NOT_DOWNLOADED = new Set(['downloadable', 'downloading']);

/** Whether a model can chat: embedding models (nomic-embed-text, …) can't. */
export const isChatModel = (model) => !/embed/i.test(model.name);

/** Gemini Nano that Chrome still has to download before it can answer. */
export const nanoNeedsDownload = (model) => Boolean(model) && isNanoModel(model.name) && NOT_DOWNLOADED.has(model.availability);

// The installed Ollama chat model of the best preferred family, else the first.
function bestChatModel(models) {
  const chat = models.filter((m) => !isNanoModel(m.name) && isChatModel(m));
  const preferred = PREFERRED_FAMILIES.map((family) => chat.find((m) => m.name.toLowerCase().includes(family))).find(Boolean);
  return (preferred ?? chat[0])?.name;
}

export function pickDefaultModel(models = []) {
  const nano = models.find((m) => isNanoModel(m.name));
  if (nano && !nanoNeedsDownload(nano)) return nano.name;
  return bestChatModel(models) || nano?.name || '';
}
