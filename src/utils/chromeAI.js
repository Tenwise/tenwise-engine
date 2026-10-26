/**
 * Chrome built-in AI (Gemini Nano) via the Prompt API.
 * Runs entirely in the browser — no server, no Ollama. Desktop Chrome 148+ only.
 * https://developer.chrome.com/docs/ai/prompt-api
 */

export const NANO_MODEL_NAME = 'gemini-nano';

// Plain Chromium ships a stub LanguageModel that reports itself available but
// just echoes the prompt back, prefixed with this message.
const CHROMIUM_STUB_PREFIX = 'On-device model is not available';
const NOT_CHROME_ERROR = 'Gemini Nano needs Google Chrome (desktop, 148+). This browser exposes the API but has no on-device model.';
const TOO_LONG_ERROR = 'This request is too long for Gemini Nano. Select fewer articles, or switch to an Ollama model in Settings → AI engines.';

// Room left in the context window for the model's answer.
const OUTPUT_RESERVE_TOKENS = 1536;
// Rough chars-per-token used only when Chrome can't measure input for us.
const FALLBACK_CHARS_PER_TOKEN = 3;

export function isNanoModel(name) {
  return name === NANO_MODEL_NAME;
}

// Gemini Nano is bundled only with Google Chrome; Chromium-based browsers
// without the "Google Chrome" brand get the stub.
function isGoogleChrome() {
  const brands = navigator.userAgentData?.brands;
  if (!brands) return true; // can't tell; the stream check below still guards
  return brands.some((b) => b.brand === 'Google Chrome');
}

function hasPromptApi() {
  return typeof self !== 'undefined' && 'LanguageModel' in self;
}

const NANO_MIN_CHROME = 148;
const AVAILABILITY_STATE = { available: 'ready', downloadable: 'downloadable', downloading: 'downloading', unavailable: 'unsupported-device' };

// Google Chrome's major version, or null in any other browser (Safari and
// Firefox have no userAgentData at all).
function chromeMajor() {
  const brand = navigator.userAgentData?.brands?.find((b) => b.brand === 'Google Chrome');
  return brand ? Number.parseInt(brand.version, 10) : null;
}

/**
 * Where Gemini Nano stands here, for setup guidance: 'ready', 'downloadable'
 * or 'downloading'; 'unsupported-device' (Chrome can't run it on this
 * computer: disk space, graphics or memory); 'old-chrome'; or 'not-chrome'.
 */
export async function nanoState() {
  if (!hasPromptApi()) {
    const major = chromeMajor();
    if (major === null) return 'not-chrome';
    return major < NANO_MIN_CHROME ? 'old-chrome' : 'unsupported-device';
  }
  if (!isGoogleChrome()) return 'not-chrome';
  try {
    return AVAILABILITY_STATE[await self.LanguageModel.availability()] ?? 'unsupported-device';
  } catch {
    return 'unsupported-device';
  }
}

const SESSION_OPTIONS = { expectedInputs: [{ type: 'text' }], expectedOutputs: [{ type: 'text' }] };

/**
 * Downloads Gemini Nano, calling onProgress(0–1) as it goes. Call it straight
 * from a click: Chrome starts the download only on a user gesture.
 */
export async function downloadNano(onProgress) {
  const session = await self.LanguageModel.create({
    ...SESSION_OPTIONS,
    monitor(m) { m.addEventListener('downloadprogress', (e) => onProgress(e.loaded)); },
  });
  session.destroy();
}

/**
 * Returns a model entry shaped like the Ollama ones, or null when the browser
 * can't run Gemini Nano.
 */
export async function getNanoModel() {
  const supported = hasPromptApi() && isGoogleChrome();
  if (!supported) return null;
  let availability;
  try {
    availability = await self.LanguageModel.availability();
  } catch {
    return null;
  }
  if (availability === 'unavailable') return null;
  return {
    name: NANO_MODEL_NAME,
    family: 'gemini',
    parameterSize: availability === 'available' ? 'Chrome · on-device' : 'Chrome · downloads on first use',
    size: 0,
    availability,
  };
}

async function createSession(messages) {
  return self.LanguageModel.create({ initialPrompts: messages, ...SESSION_OPTIONS });
}

/**
 * Finds the largest per-item character limit (≤ maxChars) for which the user
 * message fits in Gemini Nano's context window alongside the system prompt
 * and room for the answer. buildUserMessage(chars) renders the message with
 * each item trimmed to `chars`. Shrinking every item evenly keeps all of them
 * in the prompt instead of cutting the last ones off.
 * Returns { chars, trimmed }; throws when even minChars doesn't fit.
 */
export async function fitToNanoContext(systemContent, buildUserMessage, { maxChars, minChars = 200 }) {
  const session = await createSession([{ role: 'system', content: systemContent }]);
  try {
    const budget = contextBudget(session);
    if (budget === null) return { chars: maxChars, trimmed: false };
    if (budget <= 0) throw new Error(TOO_LONG_ERROR);
    const chars = await shrinkToBudget(tokenCounter(session), buildUserMessage, { budget, maxChars, minChars });
    return { chars, trimmed: chars < maxChars };
  } finally {
    session.destroy();
  }
}

// Tokens left for the user message, or null when Chrome doesn't report a
// context size. Property names changed across Chrome versions.
function contextBudget(session) {
  const windowSize = session.contextWindow ?? session.inputQuota;
  if (!windowSize) return null;
  const used = session.contextUsage ?? session.inputUsage ?? 0;
  return windowSize - used - OUTPUT_RESERVE_TOKENS;
}

function tokenCounter(session) {
  const measureFn = session.measureContextUsage ?? session.measureInputUsage;
  if (measureFn) return (text) => measureFn.call(session, text);
  return async (text) => Math.ceil(text.length / FALLBACK_CHARS_PER_TOKEN);
}

async function shrinkToBudget(countTokens, buildUserMessage, { budget, maxChars, minChars }) {
  let chars = maxChars;
  for (let attempt = 0; attempt < 6; attempt++) {
    const tokens = await countTokens(buildUserMessage(chars));
    if (tokens <= budget) return chars;
    if (chars <= minChars) break;
    chars = Math.max(minChars, Math.floor(chars * (budget / tokens) * 0.9));
  }
  throw new Error(TOO_LONG_ERROR);
}

function isQuotaError(err) {
  return err?.name === 'QuotaExceededError';
}

function tooLongError(cause) {
  return new Error(TOO_LONG_ERROR, { cause });
}

// Keeps only the system prompt, halved — a last attempt when the history
// doesn't fit Nano's context window.
function trimHistory(history) {
  const system = history.find((m) => m.role === 'system');
  if (!system) return [];
  const half = Math.floor(system.content.length / 2);
  return [{ ...system, content: system.content.slice(0, half) + '…' }];
}

async function openSession(history) {
  try {
    return await createSession(history);
  } catch (err) {
    if (!isQuotaError(err)) throw err;
  }
  try {
    return await createSession(trimHistory(history));
  } catch (err) {
    throw isQuotaError(err) ? tooLongError(err) : err;
  }
}

// Passes chunks through, but holds back the first few characters until it's
// clear the response isn't the Chromium stub echoing the prompt.
async function* rejectStubOutput(stream) {
  let head = '';
  for await (const chunk of stream) {
    if (head === null) { yield chunk; continue; }
    head += chunk;
    if (head.length < CHROMIUM_STUB_PREFIX.length) continue;
    yield checkedHead(head);
    head = null;
  }
  if (head) yield checkedHead(head);
}

function checkedHead(head) {
  if (head.startsWith(CHROMIUM_STUB_PREFIX)) throw new Error(NOT_CHROME_ERROR);
  return head;
}

/**
 * Streams a completion from Gemini Nano. Same contract as streamChat():
 * takes the full message list, yields string tokens.
 * Each call uses a fresh session so it stays stateless like the Ollama path.
 */
export async function* streamNanoChat(messages, signal) {
  if (!hasPromptApi()) throw new Error(NOT_CHROME_ERROR);
  const last = messages[messages.length - 1];
  const session = await openSession(messages.slice(0, -1));
  const controller = new AbortController();
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    yield* rejectStubOutput(session.promptStreaming(last.content, { signal: controller.signal }));
  } catch (err) {
    throw isQuotaError(err) ? tooLongError(err) : err;
  } finally {
    controller.abort();
    session.destroy();
  }
}
