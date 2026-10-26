import { safeFetch } from './urlGuard.js';

// Fetches documents for the parsers (feeds, article pages) through safeFetch,
// which re-validates every redirect hop. The parsing libraries then work on
// the text, so they never make network requests of their own.

const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;

const charsetFromContentType = (contentType) => /charset\s*=\s*"?([^";\s]+)/i.exec(contentType || '')?.[1];
const charsetFromXmlProlog = (head) => /^\s*<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/i.exec(head)?.[1];

function decoderFor(label) {
  try {
    return new TextDecoder(label || 'utf-8');
  } catch {
    return new TextDecoder('utf-8'); // unknown charset label
  }
}

/**
 * Decodes a response body using the charset from the Content-Type header,
 * else from an XML declaration, else UTF-8.
 */
export function decodeBody(bytes, contentType) {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 200));
  return decoderFor(charsetFromContentType(contentType) || charsetFromXmlProlog(head)).decode(bytes);
}

/**
 * Requests `url` (a GET unless `method` says otherwise, with an optional
 * `body`) and resolves to { text, url } (url = the final URL after
 * redirects). Throws on a non-2xx status (the error carries `status`), a
 * timeout, or a body over maxBytes.
 */
export async function fetchText(url, { method, headers = {}, body, timeoutMs = 15000, maxBytes = DEFAULT_MAX_BYTES } = {}) {
  const res = await safeFetch(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw Object.assign(new Error(`Status code ${res.status}`), { status: res.status });
  if (Number(res.headers.get('content-length')) > maxBytes) throw new Error('Response too large');
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > maxBytes) throw new Error('Response too large');
  return { text: decodeBody(bytes, res.headers.get('content-type')), url: res.url || url };
}
