import { isNanoModel } from '../utils/chromeAI.js';

// Choosing a model when the user hasn't ("Auto"), the same way in the AI rail
// and for background processing: a model a plugin engine marks preferred (one
// the person set up, such as their own key); Gemini Nano once Chrome has downloaded it;
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
  // A model the person set up themselves (a plugin engine's `preferred` one).
  const own = models.find((m) => m.preferred);
  if (own) return own.name;
  const nano = models.find((m) => isNanoModel(m.name));
  if (nano && !nanoNeedsDownload(nano)) return nano.name;
  return bestChatModel(models) || nano?.name || '';
}

/** A model's name for people: its label (a plugin engine's, such as "Tenwise AI"), Gemini Nano, or its name. */
export const modelLabel = (model) => model?.label ?? (isNanoModel(model?.name) ? 'Gemini Nano' : model?.name ?? '');

// Plugin engines' model names, for a draft that recorded only the name.
const ENGINE_NAMES = [[/^tenwise-ai$/, () => 'Tenwise AI'], [/^own-key\/(.+)$/, (m) => `${m[1]} · your key`]];

/**
 * The engine that wrote, or will write, by name people know (AI-9): the
 * model's label when it's among `models`, else Tenwise AI, "x · your key",
 * Gemini Nano, or the model name without its size tag.
 */
export function engineLabel(name, models = []) {
  if (!name) return '';
  const model = models.find((m) => m.name === name);
  if (model) return modelLabel(model);
  for (const [pattern, label] of ENGINE_NAMES) {
    const match = name.match(pattern);
    if (match) return label(match);
  }
  return isNanoModel(name) ? 'Gemini Nano' : name.split(':')[0];
}

/** What Auto would pick now, for the settings to say (AI-5): "Auto (now: Tenwise AI)", or plain "Auto" with nothing ready. */
export function autoLabel(models = []) {
  const name = pickDefaultModel(models);
  const model = models.find((m) => m.name === name);
  return model ? `Auto (now: ${modelLabel(model)})` : 'Auto';
}
