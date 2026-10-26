import express from 'express';

// For route tests: serves one router on a free loopback port, with the body
// handling server/index.js gives every route (JSON bodies, an empty body as
// {}, errors as JSON), and a client for it.

// Taken before any test stubs the global fetch, so requests to the test server
// still go out while the code under test sees the stub.
const realFetch = globalThis.fetch;

function appFor(router) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use((req, res, next) => { req.body ??= {}; next(); });
  app.use(router);
  // eslint-disable-next-line no-unused-vars -- Express needs all four arguments
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  return app;
}

const isJson = (res) => (res.headers.get('content-type') || '').includes('application/json');
// Keeps a byte-order mark (res.text() would drop it), so tests can check one was sent.
const textOf = async (res) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(await res.arrayBuffer());

/** Sends one request; resolves to { status, headers, text, body } (body: parsed JSON, if it was JSON). */
export async function send(base, method, path, body) {
  const init = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await realFetch(`${base}${path}`, init);
  const text = await textOf(res);
  return { status: res.status, headers: res.headers, text, body: isJson(res) ? JSON.parse(text) : undefined };
}

/**
 * Serves `router` at the root of a loopback server. Resolves to a client:
 * get/post/put/delete(path, body?) and close().
 */
export async function serveRouter(router) {
  const server = await new Promise((resolve) => {
    const listening = appFor(router).listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method) => (path, body) => send(base, method, path, body);
  return {
    base,
    get: call('GET'),
    post: call('POST'),
    put: call('PUT'),
    delete: call('DELETE'),
    close: () => new Promise((resolve) => { server.close(resolve); }),
  };
}
