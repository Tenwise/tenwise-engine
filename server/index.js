import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import feedsRouter from './routes/feeds.js';
import discoverRouter from './routes/discover.js';
import articlesRouter from './routes/articles.js';
import aiRouter from './routes/ai.js';
import summariesRouter from './routes/summaries.js';
import highlightsRouter from './routes/highlights.js';
import { localOnly, localOrigin, originAllowedFor, publicOrigin } from './utils/loopback.js';
import { db } from './db/database.js';
import { contentSecurityPolicy, inlineScriptHashes, securityHeaders } from './utils/securityHeaders.js';
import { appUrl, listenFailure, readyMessage } from './utils/startup.js';
import collectionsRouter from './routes/collections.js';
import ollamaRouter from './routes/ollama.js';
import readerRouter from './routes/reader.js';
import settingsRouter from './routes/settings.js';
import faviconRouter from './routes/favicon.js';
import refreshRouter from './routes/refresh.js';
import { startAutoRefresh } from './refresh/autoRefresh.js';
import { loadPlugins, pluginPublicOrigin, pluginRoutes, setPlugins } from './plugins.js';

// Features added by plugins (server/plugins.js); none unless TENWISE_SERVER_PLUGINS names a list.
setPlugins(await loadPlugins(process.env.TENWISE_SERVER_PLUGINS));

const app = express();
const PORT = Number(process.env.PORT) || 3001;
// Bind to loopback by default so the no-auth API is not exposed to the LAN.
// Override with HOST=0.0.0.0 only if you deliberately want network access.
const HOST = process.env.HOST || '127.0.0.1';
// A hosted install, behind a proxy that signs people in, learns its public
// address from a hosting plugin (server/plugins.js). Without one the API
// serves this machine only.
const RAW_PUBLIC_ORIGIN = pluginPublicOrigin();
const PUBLIC_ORIGIN = publicOrigin(RAW_PUBLIC_ORIGIN);
if (RAW_PUBLIC_ORIGIN && !PUBLIC_ORIGIN) console.warn(`Public origin "${RAW_PUBLIC_ORIGIN}" isn't a bare http(s) origin; ignoring it`);
// Behind one proxy hop (the one that signs people in), so rate limits see the visitor, not the proxy.
if (PUBLIC_ORIGIN) app.set('trust proxy', 1);

// Serve the built frontend (npm run build) so one process hosts the whole app.
// Not under `npm run dev` (--dev): Vite serves the app then, and a dist/ left
// from an earlier build would be stale. Otherwise a page names the address to open.
const DEV = process.argv.includes('--dev');
const URL_SHOWN = appUrl(HOST, PORT);
const DIST_DIR = join(dirname(fileURLToPath(import.meta.url)), '../dist');
const BUILT = !DEV && existsSync(join(DIST_DIR, 'index.html'));

// Every response, a 403 included, says the page may not be framed and sets the
// Content-Security-Policy. The built index.html's inline theme script is
// allowed by its hash, read from the file that is actually served.
const pageScripts = BUILT ? inlineScriptHashes(readFileSync(join(DIST_DIR, 'index.html'), 'utf8')) : [];
app.use(securityHeaders(contentSecurityPolicy(pageScripts)));

// This API has no auth by design (local, single-user), so only this machine
// may use it. Any website the user visits could otherwise read or delete their
// data: cross-origin (another Origin), or by pointing its own name at
// 127.0.0.1 (DNS rebinding: another Host). Both get a 403.
app.use(localOnly(HOST, PUBLIC_ORIGIN));
app.use(cors({
  // CORS headers for pages on this machine; requests with no Origin (curl,
  // same-origin) need none.
  origin: (origin, callback) => callback(null, originAllowedFor(origin, PUBLIC_ORIGIN)),
}));
// Adding a feed posts its current articles in one request, whole, so this
// route allows more than the rest.
app.use('/api/reader/articles/bulk-insert', express.json({ limit: '8mb' }));
app.use(express.json({ limit: '2mb' }));
// Express 5 leaves req.body undefined when a request has no JSON body; routes
// destructure it, so give them an empty object instead of a TypeError.
app.use((req, res, next) => { req.body ??= {}; next(); });

// Routes
app.use('/api/feeds', feedsRouter);
app.use('/api/discover', discoverRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/summaries', summariesRouter);
app.use('/api/highlights', highlightsRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/ollama', ollamaRouter);
app.use('/api/reader', readerRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/favicon', faviconRouter);
app.use('/api/refresh', refreshRouter);
for (const [path, router] of pluginRoutes({ db, localOrigin, publicOrigin: PUBLIC_ORIGIN, port: PORT })) app.use(path, router);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// The built frontend (see BUILT above), or a page naming the address to open.
if (BUILT) {
  // Generous cap — a single user loading the app never comes close — that
  // stops a runaway client from hammering the filesystem.
  const staticLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(staticLimiter, express.static(DIST_DIR));
  app.get(/^(?!\/api\/).*/, staticLimiter, (req, res) => res.sendFile(join(DIST_DIR, 'index.html')));
} else {
  app.get(/^(?!\/api\/).*/, (req, res) => res.type('text').send(readyMessage({ url: URL_SHOWN, dev: DEV, built: false })));
}

// Errors that escape a route (bad JSON, a body over the limit, anything
// thrown) come back as JSON with the right status, never an HTML stack trace.
// eslint-disable-next-line no-unused-vars -- Express needs all four arguments
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
});

// Express 5 hands a listen error (a taken port) to this callback rather than
// throwing, so without the check the server would say it started and serve nothing.
app.listen(PORT, HOST, (err) => {
  if (err) {
    console.error(listenFailure(err, PORT));
    process.exit(1);
  }
  console.log(readyMessage({ url: URL_SHOWN, dev: DEV, built: BUILT }));
  startAutoRefresh();
});
