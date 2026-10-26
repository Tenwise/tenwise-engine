# Security design

_Code paths in backticks are relative to the engine's root; links point at the files directly._

_Written: 20 October 2026. Reviewed 22 October 2026. Split from the Tenwise platform's document when the engine became its own project (25 October 2026). Update it in the same pull request as any change that crosses a trust boundary; see [Keeping this document current](#keeping-this-document-current)._

This is the Tenwise Engine's assurance case: the argument, with pointers to the code, that its security requirements are met. It covers the threat model, the trust boundaries, how secure design principles are applied, and how common weaknesses are countered. To report a vulnerability, follow [SECURITY.md](../SECURITY.md), not this document.

## Security requirements

The engine must ensure that:

1. **Content can't take over the app.** HTML from feeds and web pages cannot run script in the app, imitate the app's own controls, or read or change the user's data.
2. **URLs can't reach inward.** A URL from the user, a feed or a web page cannot make the local server request addresses on the user's machine or local network (server-side request forgery, SSRF).
3. **Other websites can't use the local API.** A website open in the same browser cannot read or change the user's library through it.
4. **Input can't become code.** Nothing the server receives is run as a command or changes the shape of a database query.
5. **Data stays local.** The library, notes and reading history stay on the user's machine. The engine makes no requests except to fetch what the user asked for.

## System overview

The engine runs on the user's own machine, for one user:

- **A React app** in the browser, served from a local origin (`http://localhost:5173` in development, or the server's own address with `npm start`).
- **An Express server** bound to `127.0.0.1`. It fetches feeds and pages for the app, owns the SQLite database in `data/`, and bridges to Ollama.
- **An AI engine.** Gemini Nano runs inside Chrome. Ollama, if used, is a separate program the user runs, reached through the server at the address in `OLLAMA_HOST` (default `http://127.0.0.1:11434`).

```
   Internet: publishers' feeds,                  Other websites open
   pages, icons and redirects                    in the same browser
              │                                           │
 ════ B1 ═════╪═ safeFetch (SSRF guard) ═══  ════ B2 ═════╪═ Host + Origin ════
              ▼                                           ▼
 ┌──────────────────────────── Express on 127.0.0.1 ────────────────────────────┐
 │  ingestion ─► parsers (text only)          storage ─► data/reader.db (B5)    │
 │  AI bridge ─► Ollama at OLLAMA_HOST (B4)                                     │
 └──────────────────────────────────────┬───────────────────────────────────────┘
                                        │ /api/* (JSON)
 ┌──────────────────────────────────────▼──────────────── React app ────────────┐
 │  article HTML ── B3: DOMPurify ──► the app's DOM                             │
 │  AI output ─► rendered as text by React                                      │
 └──────────────────────────────────────────────────────────────────────────────┘
```

The trust boundaries B1–B6 are described [below](#trust-boundaries).

**Plugins.** An app built on the engine can add features through plugin slots: `src/plugins/index.js` in the browser, and `server/plugins.js` on the server, loaded from the module `TENWISE_SERVER_PLUGINS` names. A plain engine loads none. A plugin runs with the engine's own privileges, so whoever builds such an app owns its security. Each slot is a fixed list of contributions: routes, a rewrite of the URL to extract, a feed title, and at most one public origin (see [Served beyond this machine](#served-beyond-this-machine-b2)). A plugin's fetches should go through `safeFetch` like the engine's.

## Threat model

### What is protected

- **The library** in `data/reader.db`: feeds, articles, saves and notes, collections, highlights and AI summaries. Also the settings in `data/settings.json`, which include the user's edited AI prompts.
- **The user's machine and network:** services listening on loopback or the local network, and cloud metadata endpoints.
- **The app itself:** what the user sees in it, and the actions it takes for them.
- **Privacy:** which feeds the user follows and what they read.

### Who might attack, and how

| Attacker | What they control | What they would try |
|---|---|---|
| **A hostile or compromised publisher** (the most likely attacker) | Feed XML, item HTML, item links, HTTP redirects, article pages, site icons, DNS for their own domain | Run script in the app (XSS); show a fake sign-in form; make the server fetch an internal address (SSRF); exhaust memory with a huge or endless response; slip a formula into a CSV export; steer the AI with text in the article (prompt injection) |
| **A website the user visits** in the same browser | Requests the browser sends from that page | Read or change the library through the local API (CSRF, cross-origin reads) |
| **A device on the local network** | Network access to the user's machine | Call the API, which has no authentication |
| **A compromised dependency or CI action** | Code that runs at install, build or CI time | Get malicious code into the app or the repository |

### Out of scope

- **Someone already running code as the user**, or with access to their files. They can read `data/` directly; no defense inside the engine would stop them.
- **A compromised browser, operating system or Ollama.** The engine relies on them. The Ollama at `OLLAMA_HOST` is trusted because the user chose it, though its *output* is still treated as untrusted text.
- **Exposure the user chooses.** Setting `HOST=0.0.0.0` puts the unauthenticated API on the network. The code and README call this a deliberate override.
- **Plugins.** The engine doesn't defend against a plugin it was told to load; see [Plugins](#system-overview).

## Trust boundaries

| | Boundary | What crosses it | How it is guarded |
|---|---|---|---|
| **B1** | Internet → server | Every feed, page, icon and redirect the server fetches | All server-side fetches of untrusted URLs go through `safeFetch` in [server/utils/urlGuard.js](../server/utils/urlGuard.js), with size and time limits from [server/utils/fetchText.js](../server/utils/fetchText.js). The parsers (rss-parser, @extractus/article-extractor, cheerio) only receive the fetched text, so they make no requests of their own. |
| **B2** | Other websites → local API | Requests a browser sends from another site | The server binds to `127.0.0.1` ([server/index.js](../server/index.js)). `localOnly` in [server/utils/loopback.js](../server/utils/loopback.js) refuses (403) a request whose `Host` names another site or whose `Origin` is anywhere else, before it reaches a route. CORS headers go only to origins on this machine. Every response forbids framing ([server/utils/securityHeaders.js](../server/utils/securityHeaders.js)). |
| **B3** | Untrusted HTML → the app's DOM | Article and feed HTML | The app inserts raw HTML only in the reader, and sanitizes it first: [src/components/reader/sanitize.js](../src/components/reader/sanitize.js). Everything else, including what the AI rail shows, is rendered as text by React. The built app's Content-Security-Policy is a second layer. |
| **B4** | Server → other programs | Ollama requests; `ollama serve` | Fixed commands and binaries, with no request data on a command line ([server/routes/ollama.js](../server/routes/ollama.js), [server/utils/ollamaHost.js](../server/utils/ollamaHost.js)). The Ollama address comes from the environment, never from a request. |
| **B5** | Requests → database and settings file | JSON bodies from the app | Prepared statements with bound parameters ([server/db/](../server/db/)); request bodies checked against fixed fields and limits before storage. |
| **B6** | Contributors → repository | Changes, dependency updates, CI | The engine is developed in the private Tenwise platform repository and published from it, after its CI and Security checks pass; see [Supply chain and process](#supply-chain-and-process). |

## How each threat is countered

### Hostile HTML in articles and feeds (B3)

- **Sanitized with DOMPurify** before insertion: `sanitizeArticleHtml` for extracted articles and `sanitizeFeedHtml` for the feed preview ([src/components/reader/sanitize.js](../src/components/reader/sanitize.js)). DOMPurify removes script, event handlers and `javascript:` URLs.
- **No fake controls.** `form`, `input`, `button`, `select`, `option`, `textarea` and `style` elements are removed, and so are `style`, `action` and `formaction` attributes. A feed cannot draw a "sign in again" form or a full-window overlay.
- **Video embeds only from an allowlist.** An `iframe` stays only if its host is YouTube, youtube-nocookie, Vimeo's player or SoundCloud's widget, and every kept iframe gets a fixed `sandbox` that overrides whatever the feed set. The host list is [shared/embedHosts.js](../shared/embedHosts.js), which the CSP's `frame-src` uses too.
- **A Content-Security-Policy behind the sanitizer.** The built app (`npm start` and the background service) is served with a policy that runs scripts only from the app itself, plus the inline theme script in `index.html`, allowed by its hash. It also loads no plugins (`object-src 'none'`), takes frames only from the embed hosts, and makes network requests only to its own server (`connect-src 'self'`). A script that got past DOMPurify would not run. Styles allow `'unsafe-inline'`, because Radix dialogs inject a `<style>` element, and the sanitizer already strips style attributes from article HTML. Images and media may load from any http(s) host, as articles need ([server/utils/securityHeaders.js](../server/utils/securityHeaders.js)).
- **Links can't navigate the app.** Every link gets `target="_blank"` and `rel="noopener noreferrer"`.
- **AI output is text.** The AI rail shows summaries and chat as React text, never as HTML.
- **Citations are text.** An APA citation is built from a feed's author, title and link, and the app shows it as React text. The copy that goes to the clipboard as rich text (`text/html`, for word processors) escapes `&`, `<`, `>` and `"` in every part, so a feed can't put markup into a document the user pastes it into ([shared/citation.js](../shared/citation.js), tested).

### Server-side request forgery (B1)

`safeFetch` in [server/utils/urlGuard.js](../server/utils/urlGuard.js) is the only path for server-side fetches of untrusted URLs: feeds (`feedParser.js`), feed discovery (`feedDiscovery.js`), full-text extraction (`articleExtractor.js`) and site icons (`favicon.js`), mostly through `fetchText.js`. It makes three checks:

1. **Before the request:** the URL must be `http:` or `https:`, and every address its host resolves to must be public. The blocked ranges are listed in `BLOCKED_V4`, `V6_WITH_V4` and `BLOCKED_V6`: loopback, private, carrier-grade NAT, link-local (including `169.254.169.254`, the cloud metadata address), multicast and reserved. IPv6 addresses are read as numbers, so every spelling of an address is judged alike. An IPv6 address that carries an IPv4 one (IPv4-mapped `::ffff:0:0/96`, IPv4-compatible `::/96`, NAT64 `64:ff9b::/96`, 6to4 `2002::/16`) is judged by that IPv4 address, and any other IPv6 address outside global unicast (`2000::/3`) is refused, as are Teredo and documentation ranges. An IP address written in the URL involves no DNS, so this is the only check it meets. Anything not recognized as an IP address is refused.
2. **At connect time:** the connection resolves the hostname again through `guardedLookup`, which refuses blocked addresses. A DNS server that answers "public" for the first check and "127.0.0.1" for the connection (DNS rebinding) is caught here.
3. **On every redirect:** redirects are followed by hand (`redirect: 'manual'`, at most 5), and each target is checked again before it is requested.

The favicon route accepts only a plain DNS name (`isValidHostname`: no IP addresses, ports, paths or credentials) and builds the URL itself. A plugin that rewrites the URL to extract (`resolveArticleUrl`) gets the engine's `fetchPage`, which goes through `safeFetch`, and the URL it returns is fetched through `safeFetch` too.

Tests: [server/utils/urlGuard.test.js](../server/utils/urlGuard.test.js) covers blocked schemes and ranges, IPv6 spellings of private IPv4 addresses (including a fetch through `[::ffff:127.0.0.1]` to a server on `127.0.0.1`), redirects into private addresses and a host that rebinds to loopback; [server/utils/favicon.test.js](../server/utils/favicon.test.js) covers hostname checks.

### Other websites and the local network (B2)

- **Loopback only.** The server listens on `127.0.0.1` unless `HOST` says otherwise. The macOS background service sets `HOST=127.0.0.1` explicitly ([scripts/service.sh](../scripts/service.sh)).
- **Addressed to this machine.** `localOnly` ([server/utils/loopback.js](../server/utils/loopback.js)) answers 403 unless the `Host` header is `localhost`, a `*.localhost` name, an IP address, or the `HOST` the server was started with. A page on another site can point its own name at `127.0.0.1` (DNS rebinding) and then call the API as the same origin, with no `Origin` header; its `Host` still names that site, so it is refused.
- **Local origins only.** Browsers attach an `Origin` header to cross-origin requests. `localOnly` refuses (403) any origin that isn't on this machine, and CORS headers go only to local origins, so another site can neither read responses nor make the server act on a request. Requests with no `Origin` (curl, same-origin page loads) are allowed; the `Host` check covers the same-origin case.
- **JSON bodies.** Routes that take data read JSON (`express.json`), which a plain HTML form on another site can't send.
- **Not framed, not sniffed.** Every response, a 403 included, carries `X-Frame-Options: DENY` and `frame-ancestors 'none'`, so another site can't show the app in a hidden frame and trick a click on something like "Delete all" (clickjacking). `X-Content-Type-Options: nosniff` stops a browser from running a response as a type it wasn't served as. Under `npm run dev` and `npm run preview`, Vite sends the same anti-framing headers ([vite.config.js](../vite.config.js)). A route that needs a stricter policy, such as site icons, replaces these headers.

Tests: [server/utils/loopback.test.js](../server/utils/loopback.test.js) covers the `Host` and `Origin` decisions, public-origin parsing, and the middleware over HTTP with another site's `Host` and `Origin`.

### Served beyond this machine (B2)

The engine alone serves this machine only. An app built on it can serve it at one public address, behind a proxy that signs people in, by loading a server plugin that names that address (`publicOrigin`, [server/plugins.js](../server/plugins.js)). The `PUBLIC_ORIGIN` environment variable on its own does nothing.

- **Exactly one origin.** It must be a bare `http(s)` origin, with no path, query or credentials, or the server ignores it with a warning. `localOnly` then also accepts that origin's hostname as `Host` and that exact origin as `Origin`, and CORS answers it ([server/utils/loopback.js](../server/utils/loopback.js)). Every other site is still refused.
- **Proxy-aware rate limits.** With a public origin, Express trusts one proxy hop (`trust proxy` = 1), so rate limits count the visitor rather than the proxy.
- **The API still has no authentication.** The proxy in front is the login; whoever runs such an install owns that part.

Tests: [server/index.test.js](../server/index.test.js) checks that `PUBLIC_ORIGIN` alone doesn't open the API to that origin, and that a hosting plugin naming it does, for that origin only.

### Injection into SQLite (B5)

- All queries use better-sqlite3 prepared statements with bound parameters (`?` or `@name`). User values never become part of the SQL text.
- Where SQL is assembled, every piece comes from code, never from a request: column names from the fixed `ARTICLE_FIELDS` table ([server/db/reader.js](../server/db/reader.js)), filter keys from `FILTER_KEYS` ([shared/aiFilters.js](../shared/aiFilters.js)), view conditions from a `switch` ([server/db/articlePages.js](../server/db/articlePages.js)), and placeholder lists generated from an array's length.
- Full-text search terms are quoted for FTS5 (quotes doubled) and passed as a bound parameter to `MATCH`, at most 10 terms per query.

Tests: `server/db/*.test.js`, including [search.test.js](../server/db/search.test.js).

### Command injection and the Ollama bridge (B4)

- The server runs only fixed commands: `which ollama` (`where ollama` on Windows) and `ollama serve` through `spawn` with an argument array. The `ollama` binary is the one on `PATH` or at a fixed install location.
- The model name in a model download (`/api/ollama/pull`) goes to Ollama's HTTP API as a JSON field, not to a command line.
- `OLLAMA_HOST` is read once, from the environment, at startup ([server/utils/ollamaHost.js](../server/utils/ollamaHost.js)). No request can change where the bridge connects.
- `/api/ollama/start` and `/api/ollama/pull` are rate limited to 20 requests a minute.

### Prompt injection

An article can contain text written to steer the model. The AI has no tools: it cannot fetch URLs, run commands or write data. Its output is stored as the summary the user asked for, and shown as text. The worst case is a misleading summary of a hostile article.

### Resource exhaustion

- Fetched documents: 15-second timeout and 15 MB cap ([server/utils/fetchText.js](../server/utils/fetchText.js)). Icons: 8 seconds and 512 KB.
- Request bodies: 2 MB, or 8 MB on the bulk-insert route ([server/index.js](../server/index.js)).
- Static files are rate limited when the server hosts the built app.
- Tag stripping runs in one linear pass, so crafted input like `<<<<…` can't cause catastrophic regex backtracking ([server/utils/text.js](../server/utils/text.js), tested in `text.test.js`).

### Smaller vectors

- **Site icons** come from third parties and may be SVG. `/api/favicon` serves them with `Content-Security-Policy: default-src 'none'; …; sandbox` and `X-Content-Type-Options: nosniff`, so an icon opened directly can't run script against the API ([server/routes/favicon.js](../server/routes/favicon.js)).
- **CSV exports** prefix cells that start with `=`, `+`, `-`, `@`, tab or carriage return, so a spreadsheet doesn't run them as formulas ([shared/csv.js](../shared/csv.js), tested).
- **Settings** accept only known keys (`SYNCED_SETTING_KEYS`), string values and a length limit ([server/settings.js](../server/settings.js), tested). Collection requests keep only known fields within fixed limits ([server/routes/collectionsInput.js](../server/routes/collectionsInput.js), tested).
- **Errors** that escape a route return JSON with a status code, and a 500 says only "Internal server error". No stack traces reach the client.

## Secure design principles

How the classic principles (Saltzer and Schroeder) and a few practical ones are applied:

- **Economy of mechanism.** One fetch path (`safeFetch`), one sanitizer module, one database module with prepared statements. There is no login system to get wrong, because there is one user on one machine.
- **Fail-safe defaults.** Loopback unless told otherwise; an unrecognized or unresolvable address is refused; an iframe is dropped unless its host is allowlisted; a `Host` or origin is refused unless it is local; an unknown settings key is rejected; no plugins unless the engine is told to load them.
- **Complete mediation.** Every redirect hop is checked again, every connection's DNS answer is checked, and every request passes the `Host` and origin checks.
- **Open design.** The engine's code and this document are public. Nothing depends on a secret: there are no keys, tokens or hosted services.
- **Least privilege.** The server runs as the user, never as root. The parsing libraries get text and no network access. Embedded iframes are sandboxed. CI tokens are read-only.
- **Least common mechanism.** Site icons, served from the app's own origin, are sandboxed so they can't share its privileges.
- **Psychological acceptability.** The safe setup is the default and needs no configuration: no keys, no accounts, no firewall rules. Errors say what went wrong and how to fix it.
- **Input validation with allowlists.** URL schemes, iframe hosts, settings keys, SQL columns and filter keys are all checked against lists of what is allowed, not of what is forbidden.
- **Limited resources.** Every fetch of untrusted content, request body and icon has a size, time or rate limit.

## Common weaknesses countered

| Weakness | Countered by | Tested in |
|---|---|---|
| CWE-79 Cross-site scripting | DOMPurify on every raw-HTML sink; React escaping everywhere else; a CSP that runs only the app's own scripts | `securityHeaders.test.js` for the CSP; the sanitizer has no DOM in the test runner yet (see [Known limits](#known-limits-and-accepted-risks)) |
| CWE-1021 UI redress, clickjacking | `X-Frame-Options: DENY` and `frame-ancestors 'none'` on every response; forms, inputs and inline styles removed; iframe host allowlist and fixed sandbox | `securityHeaders.test.js`, `index.test.js` |
| CWE-918 Server-side request forgery | `safeFetch`: scheme allowlist, blocked ranges in every IPv6 spelling, connect-time DNS check, re-checked redirects | `urlGuard.test.js`, `favicon.test.js` |
| CWE-352 Cross-site request forgery | Loopback binding; `localOnly` refuses another site's `Host` (DNS rebinding) and `Origin`; JSON bodies | `loopback.test.js`, `index.test.js` |
| CWE-89 SQL injection | Prepared statements with bound parameters; SQL fragments only from code | `server/db/*.test.js` |
| CWE-78 OS command injection | Fixed commands; `spawn` with an argument array; no request data on a command line | n/a: no request data reaches a command |
| CWE-1236 CSV injection | Formula prefixes neutralized | `shared/csv.test.js` |
| CWE-1321 Prototype pollution | Settings checked with `Object.hasOwn` against a fixed key list; search results kept in arrays, never in objects keyed by user input | `settings.test.js`, `server/db/search.test.js` |
| CWE-1333 Regular expression DoS | Linear tag stripping | `text.test.js` |
| CWE-400, CWE-770 Resource exhaustion | Size, time and rate limits | `fetchText`, `favicon` and route tests |
| CWE-209 Error details exposed | Central error handler; generic 500 message | n/a |
| CWE-1357, CWE-829 Untrusted components | Lockfile installs, Dependabot, pinned actions, Semgrep, `npm audit` | CI |

## Supply chain and process

- **Where the engine is developed.** The engine is a folder in Tenwise's private platform repository, and this repository is a copy published from it. Every change there runs lint, the tests on Linux, macOS and Windows, Semgrep (the `p/javascript`, `p/nodejsscan` and `p/secrets` rule sets, ERROR level) and `npm audit` on production dependencies before it merges, and Semgrep also runs weekly.
- **Dependencies:** installed from the lockfile with `npm ci`. Dependabot proposes npm and GitHub Actions updates weekly.
- **CI:** GitHub Actions are pinned to commit SHAs, workflow tokens are read-only, and checkout doesn't keep credentials.
- **Vulnerability reports:** private, as [SECURITY.md](../SECURITY.md) describes.

## Known limits and accepted risks

- **No authentication on the API.** Any program running as the user can call it, and could read `data/` directly anyway. This is accepted for a single-user, local app.
- **The dev server has no script policy.** Under `npm run dev`, Vite serves the app with the anti-framing headers only, because its hot reload needs inline scripts. The built app has the full policy.
- **The CSP doesn't limit images or media.** Articles load them from any http(s) host, so the policy's protection comes from refusing to run scripts, not from limiting where the page can load from.
- **The sanitizer rules have no automated test.** The test runner has no DOM, and DOMPurify does not run under the lightweight DOM already installed (linkedom): it returns its input unchanged. Changes to `sanitize.js` are checked by hand until that changes. The names it gives links and images for screen readers are plain functions in `accessibleMarkup.js`, which do have tests.
- **Publishers see article opens.** Images and allowlisted video embeds load from the publisher's servers when the user opens an article, as they would on the publisher's site.
- **Data is not encrypted at rest.** `data/` relies on the operating system's account permissions and disk encryption.
- **A remote Ollama receives article text in plain HTTP.** Only if the user points `OLLAMA_HOST` at another machine.
- **Releases and tags are not signed.** Users install from source with git.

## Keeping this document current

Update this document in the same change when a change:

- adds a server route that fetches a URL, or a new way for a URL to reach `safeFetch`;
- inserts raw HTML anywhere new, or changes `sanitize.js`;
- starts a process, or changes how Ollama is reached;
- builds SQL from anything other than fixed fragments;
- changes the server's binding, its Host or Origin checks, its request limits, or what a plugin may change about them;
- changes the security headers, the Content-Security-Policy or the embed hosts.

It is also reviewed at each minor release.
