// Message builders for the single-article AI tasks (summary, chat), plus a
// helper that runs a task to completion. Components stream tokens themselves
// when they need live output.
import { streamChat } from '../utils/api.js';
import { buildSystemPrompt, voiceInstructions } from './voice.js';
import { articleContext } from './context.js';
import { getPrompt } from './promptRegistry.js';

// `voice` (voice.js) defaults to the reader's; tests pass their own.
export function summaryMessages(article, extractedContent, voice = voiceInstructions()) {
  return [
    { role: 'system', content: buildSystemPrompt(getPrompt('summary'), voice) },
    { role: 'user', content: articleContext(article, extractedContent) },
  ];
}

export function chatMessages(article, extractedContent, history, voice = voiceInstructions()) {
  const system = `${buildSystemPrompt(getPrompt('chat'), voice)}\n\nARTICLE:\n${articleContext(article, extractedContent)}`;
  return [{ role: 'system', content: system }, ...history];
}

// `stop` is an AbortSignal (preferred: it also cancels the request) or a
// function returning true once the caller wants to stop.
const stopCheck = (stop) => (typeof stop === 'function' ? stop : () => Boolean(stop?.aborted));
const signalOf = (stop) => (typeof stop === 'function' ? undefined : stop);

// Yields the model's tokens until done or stopped; a stop is not an error.
async function* tokensUntilStopped(model, messages, stop) {
  const stopped = stopCheck(stop);
  try {
    for await (const token of streamChat(model, messages, signalOf(stop))) {
      if (stopped()) return;
      yield token;
    }
  } catch (err) {
    if (!stopped()) throw err;
  }
}

/** Streams a task's tokens to onToken until done or stopped (see stopCheck). */
export async function streamTokens(model, messages, onToken, stop) {
  for await (const token of tokensUntilStopped(model, messages, stop)) onToken(token);
}

/** Runs a task and returns the full response, or what arrived before a stop. */
export async function collectResponse(model, messages, stop) {
  let response = '';
  for await (const token of tokensUntilStopped(model, messages, stop)) response += token;
  return response;
}
