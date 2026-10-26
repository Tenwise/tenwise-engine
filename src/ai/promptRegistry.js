// Every AI prompt the app sends, with its default text, so each can be read
// and replaced in Settings → Prompts. Plugins add their own prompts (the
// `prompts` slot, src/plugins/index.js) after the app's. Edits are saved (by
// prompt id) in the synced setting 'tenwise-prompts'; an empty edit means
// "use the default".
import { pluginsOf } from '../plugins/index.js';
import { readStoredObject, writeStored } from '../utils/storage.js';
import * as P from './prompts.js';
import { voiceNote } from './voice.js';

export const PROMPTS_KEY = 'tenwise-prompts';

const withVoice = (note) => [note, voiceNote()].filter(Boolean).join(' ');

const appPrompts = () => [
  { id: 'summary', group: 'Single article', label: 'Summary', defaultText: P.BASE_SUMMARY, note: withVoice('On-demand summary in the AI rail.') },
  { id: 'chat', group: 'Single article', label: 'Chat', defaultText: P.BASE_CHAT, note: `${withVoice('Questions about the open article.')} The article follows.` },
];

/** Every prompt: the app's, then each plugin's. */
export const allPrompts = () => [...appPrompts(), ...pluginsOf('prompts')];

const defaultText = (id) => allPrompts().find((p) => p.id === id).defaultText;

/** The saved edits: { promptId: text }. */
export function promptEdits() {
  return readStoredObject(PROMPTS_KEY);
}

/** The text to send for a prompt: the user's edit, or the default. */
export function getPrompt(id) {
  const edited = promptEdits()[id];
  return edited?.trim() ? edited : defaultText(id);
}

/** Saves an edit; empty or default text removes it (back to the default). */
export function savePrompt(id, text) {
  const edits = { ...promptEdits() };
  if (!text?.trim() || text === defaultText(id)) delete edits[id];
  else edits[id] = text;
  writeStored(PROMPTS_KEY, JSON.stringify(edits));
}
