import { Router } from 'express';
import { pipeBody, setStreamHeaders } from '../utils/stream.js';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { totalmem } from 'os';
import rateLimit from 'express-rate-limit';
import { installPaths, ollamaBase, whichCommand } from '../utils/ollamaHost.js';

const execAsync = promisify(exec);
const OLLAMA_BASE = ollamaBase();
const router = Router();

// Throttle the routes that spawn processes / trigger model downloads, so a
// runaway client (or a script) can't hammer them.
const processLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

/** Absolute path of the ollama binary, or null when it isn't installed. */
async function findOllama() {
  try {
    const { stdout } = await execAsync(whichCommand());
    const first = stdout.split(/\r?\n/)[0].trim(); // `where` lists every match
    if (first) return first;
  } catch { /* not on PATH */ }
  return installPaths().find((p) => existsSync(p)) ?? null;
}

async function isOllamaInstalled() {
  return (await findOllama()) !== null;
}

// Starts `ollama serve` detached. Resolves once the process has started;
// rejects if it can't (a spawn failure is an 'error' event, which would
// otherwise crash the server).
export function spawnOllama(binary) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['serve'], { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

async function getOllamaStatus() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return { running: false, models: [] };
    const data = await res.json();
    const models = (data.models || []).map((m) => ({
      name: m.name,
      family: m.details?.family || '',
      parameterSize: m.details?.parameter_size || '',
      size: m.size,
    }));
    return { running: true, models };
  } catch {
    return { running: false, models: [] };
  }
}

/**
 * GET /api/ollama/status
 * Returns { installed, running, models[], memoryGB }. memoryGB, this computer's
 * memory, lets setup suggest a model that fits.
 */
router.get('/status', async (req, res) => {
  const memoryGB = Math.round(totalmem() / 2 ** 30);
  // Fast path: if Ollama is already responding, skip the slow `which ollama` check entirely
  const { running, models } = await getOllamaStatus();
  if (running) {
    return res.json({ installed: true, running: true, models, memoryGB });
  }
  // Slow path: only exec when Ollama isn't responding
  const installed = await isOllamaInstalled();
  res.json({ installed, running: false, models: [], memoryGB });
});

/**
 * POST /api/ollama/start
 * Spawns `ollama serve` as a detached background process.
 */
router.post('/start', processLimiter, async (req, res) => {
  const binary = await findOllama();
  if (!binary) return res.status(404).json({ error: 'Ollama is not installed' });
  try {
    await spawnOllama(binary);
    res.json({ started: true });
  } catch (err) {
    res.status(500).json({ error: `Could not start Ollama: ${err.message}` });
  }
});

/**
 * POST /api/ollama/pull
 * Streams `ollama pull <model>` progress as newline-delimited JSON.
 * Body: { model: string }
 */
router.post('/pull', processLimiter, async (req, res) => {
  const { model } = req.body;
  if (!model) return res.status(400).json({ error: 'model is required' });

  setStreamHeaders(res);

  try {
    const ollamaRes = await fetch(`${OLLAMA_BASE}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: true }),
    });
    if (!ollamaRes.ok) {
      res.write(JSON.stringify({ error: 'Pull request failed' }) + '\n');
      return;
    }
    await pipeBody(ollamaRes.body, req, res);
  } catch (err) {
    if (!res.writableEnded) {
      res.write(JSON.stringify({ error: err.message }) + '\n');
    }
  } finally {
    res.end();
  }
});

export default router;
