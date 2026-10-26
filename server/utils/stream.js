/** Headers for a long-lived, unbuffered streaming response. */
export function setStreamHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
}

/**
 * Copies a fetch response body to `res` as it arrives. Cancels the upstream
 * read (so Ollama stops generating) if the client disconnects. Listens on
 * `res`: by the time this runs, express.json has consumed the request and
 * `req` has already emitted 'close'. Resolves when the body ends; does not end `res`.
 */
export async function pipeBody(body, req, res) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  res.on('close', () => { if (!res.writableEnded) reader.cancel().catch(() => {}); });
  while (true) {
    const { done, value } = await reader.read();
    if (done) return;
    res.write(decoder.decode(value, { stream: true }));
  }
}
