// How much article text goes to the model, in characters. Larger budgets give
// the model more to work with but are slower, and small models (Gemini Nano)
// may not fit them. Edited in Settings → Prompts; saved in the synced setting
// 'tenwise-ai-limits'. Plugins add their own limits (the `aiLimits` slot,
// src/plugins/index.js) after the app's.
import { pluginsOf } from '../plugins/index.js';
import { readStoredObject, writeStored } from '../utils/storage.js';

export const LIMITS_KEY = 'tenwise-ai-limits';

const APP_LIMITS = [
  { id: 'article', label: 'Article text for summaries and chat', defaultValue: 6000, min: 1000, max: 60000 },
];

/** Every limit: the app's, then each plugin's. */
export const allLimits = () => [...APP_LIMITS, ...pluginsOf('aiLimits')];

const limitOf = (id) => allLimits().find((l) => l.id === id);
const clamp = (n, { min, max }) => Math.min(max, Math.max(min, n));

function limitEdits() {
  return readStoredObject(LIMITS_KEY);
}

/** A limit's value: the user's edit (kept within its range), or the default. */
export function getLimit(id) {
  const limit = limitOf(id);
  const edited = Number(limitEdits()[id]);
  return Number.isFinite(edited) && edited > 0 ? clamp(Math.round(edited), limit) : limit.defaultValue;
}

/** Saves a limit; null or the default removes the edit. */
export function saveLimit(id, value) {
  const edits = { ...limitEdits() };
  const limit = limitOf(id);
  if (value === null || value === limit.defaultValue) delete edits[id];
  else edits[id] = clamp(Math.round(value), limit);
  writeStored(LIMITS_KEY, JSON.stringify(edits));
}
