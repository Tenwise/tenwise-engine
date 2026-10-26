// The reader's voice in AI answers: text that plugins (src/plugins/index.js)
// add after a system prompt, such as a persona and a tone. A plain build adds
// none, so every prompt goes as written.
import { pluginsOf } from '../plugins/index.js';

/** The voice plugins' contributions: { id, instructions(), record?(), note?, Strip?, Chips? }. */
export const voices = () => pluginsOf('voice');

/** The voice text to add after a system prompt: '' without voice plugins. */
export const voiceInstructions = () => voices().map((v) => v.instructions()).join('');

/** A system prompt with the voice added: `voice` defaults to the reader's. */
export const buildSystemPrompt = (basePrompt, voice = voiceInstructions()) => basePrompt + voice;

/** The summaries-library fields that record the voice a summary was made in. */
export const voiceRecord = () => Object.assign({}, ...voices().map((v) => v.record?.() ?? {}));

/** Said under each prompt the voice is added to, in Settings → Prompts. */
export const voiceNote = () => voices().map((v) => v.note).filter(Boolean).join(' ');
