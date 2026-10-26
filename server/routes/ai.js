import { Router } from 'express';
import { pipeBody, setStreamHeaders } from '../utils/stream.js';
import { ollamaBase } from '../utils/ollamaHost.js';

const OLLAMA_BASE = ollamaBase();
const router = Router();

/**
 * GET /api/ai/models
 * Returns list of locally available Ollama models. Ollama is optional, so
 * "not running" returns an empty list rather than an error.
 */
router.get('/models', async (req, res) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Ollama responded with ${response.status}`);
    const data = await response.json();
    const models = (data.models || []).map((m) => ({
      name: m.name,
      family: m.details?.family || '',
      parameterSize: m.details?.parameter_size || '',
      size: m.size,
    }));
    res.json({ models });
  } catch {
    clearTimeout(timeout);
    res.json({ models: [], ollamaAvailable: false });
  }
});

// POSTs a chat request to Ollama, aborting if it hasn't answered within 15 s.
async function postOllamaChat(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// Tenwise asks for the answer without the model's reasoning (think:
// false): reasoning models are much slower otherwise, and the reasoning isn't
// shown. An Ollama that refuses the field for a model gets the plain request.
export async function postChatWithoutThinking(body, post = postOllamaChat) {
  const res = await post({ ...body, think: false });
  if (res.status !== 400) return res;
  const text = await res.text();
  if (/think/i.test(text)) return post(body);
  return new Response(text, { status: 400 });
}

function sendOllamaError(res, err) {
  if (res.headersSent) return;
  if (err.name === 'AbortError') {
    res.status(504).json({ error: 'Ollama did not respond in time. Is the model loaded?' });
  } else {
    res.status(503).json({ error: 'Ollama is not reachable', detail: err.message });
  }
}

function isValidChat({ model, messages }) {
  if (!model || !Array.isArray(messages)) return false;
  return messages.length > 0;
}

/**
 * POST /api/ai/chat
 * Proxies a chat request to Ollama and streams the NDJSON response back.
 * Body: { model: string, messages: [{role, content}], stream?: boolean }
 */
router.post('/chat', async (req, res) => {
  const { model, messages, stream = true } = req.body;
  if (!isValidChat(req.body)) {
    return res.status(400).json({ error: 'model and messages[] are required' });
  }

  try {
    const ollamaRes = await postChatWithoutThinking({ model, messages, stream });
    if (!ollamaRes.ok) {
      return res.status(ollamaRes.status).json({ error: await ollamaRes.text() });
    }
    if (!stream) return res.json(await ollamaRes.json());

    setStreamHeaders(res);
    pipeBody(ollamaRes.body, req, res).catch(() => {}).finally(() => res.end());
  } catch (err) {
    sendOllamaError(res, err);
  }
});

export default router;
