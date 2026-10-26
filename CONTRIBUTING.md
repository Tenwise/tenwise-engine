# Contributing to the Tenwise Engine

Thanks for your interest! The engine is developed inside Tenwise's own repository and published here, so this repository is a read-only copy: changes land there first and arrive here with each release.

**For now the engine takes issues, not pull requests.** Bug reports, feature ideas and documentation fixes are all welcome as issues. A pull request here would be overwritten by the next release.

## Guiding principles

Every change to the engine keeps these promises:

1. **Local-first, always.** All user data stays on the user's machine. No cloud services, no telemetry, no accounts, no external analytics.
2. **AI is optional and on-device.** AI features run on the user's own machine, through Gemini Nano built into Chrome (the default) or the user's local Ollama. No hosted AI APIs, no API keys, no usage costs.
3. **Privacy over convenience.** When a feature trades privacy for convenience, privacy wins.
4. **Useful to one person on their own laptop.** A feature belongs in the engine if someone with no account, on their own machine, would want it. Features that need accounts, shared servers or curation are built on top of the engine, through its plugin slots, not inside it.

## Reporting bugs

Open an issue. Please include:

- Steps to reproduce, expected vs. actual behavior
- OS, browser, and Node.js version
- For AI issues: the engine and model (Gemini Nano with your Chrome version, or your Ollama version and model)
- Any errors from the browser console or the terminal running `npm run dev`

Report security problems privately, as [SECURITY.md](SECURITY.md) describes, not in an issue.

## Running it from source

```bash
npm ci
npm run dev
npm run lint
npm test
```

[README.md](README.md) covers setup, and [docs/SECURITY-DESIGN.md](docs/SECURITY-DESIGN.md) the threat model.

## License

The engine is licensed under the GNU Affero General Public License, version 3: see [LICENSE](LICENSE) and [NOTICE](NOTICE).
