# Run the engine locally

This guide takes you from nothing to the Tenwise Engine running on your own computer, using only its GitHub repository: what to install, how to get it, how to configure it, where your data lives, how to update it, and how to tell which version you're running. The [README](../README.md) has the short version and the full feature list.

Last checked with **Tenwise Engine 0.3.0** on 16 November 2026, on macOS (Apple silicon) with Node.js 24.22 and npm 11.19.

## What you need

| | Version | Check with |
|---|---|---|
| **Node.js** | 22.19 or later in 22.x, or 24 or later. 24 LTS is recommended. npm comes with it. | `node -v` |
| **git** | Any recent version | `git --version` |
| **Google Chrome** (desktop) | 148 or later, for the built-in Gemini Nano AI. Any modern browser runs the rest. | `chrome://version` |
| **Ollama** | Optional, for larger local AI models | `ollama --version` |

The engine runs on macOS, Linux and Windows, on x64 or arm64. Its one native module, the SQLite driver, ships ready-built for those, so you don't need a compiler.

On an older Node, `npm ci` refuses to install and names the Node it needs. With [nvm](https://github.com/nvm-sh/nvm), `nvm install` in the engine's folder installs the version in its `.nvmrc`. nvm-windows doesn't read `.nvmrc`: run `nvm install 24` and `nvm use 24`.

You need no account, no API key and no configuration file.

## Get it from GitHub

```bash
git clone https://github.com/Tenwise/tenwise-engine.git
cd tenwise-engine
```

`main` is always the latest release. Each release is also a tag (`v0.1.3`, for example), listed at [github.com/Tenwise/tenwise-engine/tags](https://github.com/Tenwise/tenwise-engine/tags). To run a particular one, check out its tag: `git checkout v0.1.3`.

## Install

```bash
npm ci
```

`npm ci` installs exactly the versions in `package-lock.json`. Use it rather than `npm install`, which can change the lockfile. It takes a few seconds and needs about 400 MB in `node_modules/`.

## First run

```bash
npm run dev
```

Open **http://localhost:5173** in Chrome. `npm run dev` starts two things: the app on port 5173 (Vite, for development) and the engine's API on port 3001. The terminal says `Tenwise API is up on http://localhost:3001` once it's ready. Press `Ctrl + C` to stop both.

To run it the way you would every day, without the development server:

```bash
npm start
```

That builds the app and serves everything, app and API, from **http://localhost:3001**.

The library starts empty. Press **+** in the left rail to add a feed: paste a site's address, search the catalog, pick from Popular, or import an OPML file from another reader in **Settings → Data**.

To check it from a terminal:

```bash
curl http://localhost:3001/api/health
```

It answers `{"status":"ok","version":"…",…}` with the version that is running.

On a Mac, you can also run it as a background service that starts when you log in, at http://tenwise.localhost:4317: see [Run it like an app](../README.md#run-it-like-an-app-macos) in the README.

## Configuration

Everything is optional. Set these in the shell you start the engine from.

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `3001` | The API's port, and with `npm start` the app's too. Change it when 3001 is taken: `PORT=3002 npm run dev`. The development app stays on 5173 and follows the API to the new port. |
| `TENWISE_DATA_DIR` | `data/` in the engine's folder | Where your library is kept (below). |
| `OLLAMA_HOST` | `127.0.0.1:11434` | Where Ollama listens, written the way Ollama reads it, for example `gpu-box:11434`. |
| `HOST` | `127.0.0.1` | The address the API listens on. Leave it: the engine is built for one person on their own machine, and anything else makes it reachable from your network. |

**On Windows**, these examples are for macOS and Linux. In PowerShell, write `$env:PORT=3002; npm run dev`; in Command Prompt, `set "PORT=3002" && npm run dev`.

Everything else is a setting in the app (**Settings**, or ⌘K / Ctrl+K), saved in `settings.json` in your data folder.

## Where your data lives

| What | Where |
|---|---|
| Feeds, folders, articles, saves and notes, collections, highlights, AI summaries, the search index | `reader.db`, one SQLite database, in the data folder |
| Settings | `settings.json`, in the data folder |
| Pane widths and other per-device layout | Your browser's `localStorage` |

The data folder is `data/` in the engine's folder, or `TENWISE_DATA_DIR`. The engine creates it on first run. git ignores it, so updating never touches it.

**Back up** by stopping the engine and copying the data folder. To start fresh, stop the engine and move the folder away.

### Open a library downloaded from Tenwise

**Settings → Data → Download your library** in the Tenwise app gives you one file, `tenwise-library-<date>.db`. To open it here, copy it in as `reader.db` **before** you start the engine:

```bash
mkdir -p data
cp ~/Downloads/tenwise-library-*.db data/reader.db
npm run dev
```

Never copy over the `reader.db` of an engine that is running. To keep the library somewhere else, put the file in that folder as `reader.db` and start the engine with `TENWISE_DATA_DIR=<folder>`. Update the engine first (below), so it knows everything the app saved; your own AI key, if you added one in the app, isn't in the download.

## Update

Stop the engine, back up the data folder, then:

```bash
git pull
npm ci
npm run dev
```

`npm ci` again matters: an update can change dependencies, and the SQLite driver is built for the Node that installed it. To move to a particular release instead, `git fetch --tags` and `git checkout v<version>`, then `npm ci`.

Your library comes with you. When a new version needs a change to the database, it makes it on its first start, and keeps your data.

With the macOS background service, `npm run service restart` after `git pull` does the `npm ci`, the build and the restart.

## Which version am I running?

| To know | Run |
|---|---|
| The version you have checked out | `git describe --tags` (a tag like `v0.1.3` means exactly that release), or `node -p "require('./package.json').version"` |
| The version that is running | `curl http://localhost:3001/api/health` (or your `PORT`; the service is on 4317). It can be older than the checkout until you restart. |
| The latest release | [github.com/Tenwise/tenwise-engine/tags](https://github.com/Tenwise/tenwise-engine/tags), or `git fetch --tags && git tag --sort=-v:refname \| head -1` |

The version badge at the top of the README is the version of the files you're reading.

## If something goes wrong

The README's [Troubleshooting](../README.md#troubleshooting) covers the usual ones: an old Node, a module built for another Node, a port in use, a feed that won't add, and AI that isn't available. To report a problem, open an issue at [github.com/Tenwise/tenwise-engine/issues](https://github.com/Tenwise/tenwise-engine/issues) with the output of `git describe --tags`, `node -v` and your operating system; for security problems, follow [SECURITY.md](../SECURITY.md) instead.
