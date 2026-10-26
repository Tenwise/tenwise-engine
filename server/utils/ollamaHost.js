import { join } from 'node:path';

// Where Ollama is and where it listens, from the same settings Ollama reads.

const DEFAULT_BASE = 'http://127.0.0.1:11434';
const ANY_ADDRESS = new Set(['0.0.0.0', '[::]']);

/**
 * Ollama's address from OLLAMA_HOST, which Ollama itself reads: "host",
 * "host:port" or a URL ("http://gpu-box:11434"). No port means 11434 over
 * http; an all-interfaces bind address (0.0.0.0) is reached on this machine.
 * Unset or unreadable: Ollama's default.
 */
export function ollamaBase(raw = process.env.OLLAMA_HOST) {
  const value = (raw || '').trim();
  if (!value) return DEFAULT_BASE;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `http://${value}`);
    if (!url.port && url.protocol === 'http:') url.port = '11434';
    if (ANY_ADDRESS.has(url.hostname)) url.hostname = '127.0.0.1';
    return url.origin;
  } catch {
    console.warn(`OLLAMA_HOST "${value}" isn't an address; using ${DEFAULT_BASE}`);
    return DEFAULT_BASE;
  }
}

/** The command that prints where `ollama` is on PATH. */
export const whichCommand = (platform = process.platform) => (platform === 'win32' ? 'where ollama' : 'which ollama');

/**
 * Where installers put the ollama binary, for when the server's PATH (a
 * launchd service, say) doesn't include it. On macOS the app's own copy is
 * included, for when its /usr/local/bin link wasn't made.
 */
export function installPaths({ platform = process.platform, env = process.env } = {}) {
  if (platform === 'win32') return env.LOCALAPPDATA ? [join(env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe')] : [];
  const paths = ['/opt/homebrew/bin/ollama', '/usr/local/bin/ollama', '/usr/bin/ollama'];
  return platform === 'darwin' ? [...paths, '/Applications/Ollama.app/Contents/Resources/ollama'] : paths;
}
