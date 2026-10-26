// Runs before `npm run dev` and `npm run build`. On an unsupported Node, the
// tools fail with errors that don't name the cause (Vite: "does not provide an
// export named 'styleText'"), so this stops first and says what to do.
// Keep the syntax plain: it has to run on the old Node versions it rejects.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

// "v22.13.1" or ">=24" → [major, minor, patch], missing parts as 0.
function parse(version) {
  const parts = version.replace(/^[v^>=\s]+/, '').split('.');
  return [0, 1, 2].map((i) => Number(parts[i]) || 0);
}

function atLeast(version, min) {
  for (let i = 0; i < 3; i += 1) {
    if (version[i] !== min[i]) return version[i] > min[i];
  }
  return true;
}

const ALTERNATIVE = /^(\^|>=)\d+(\.\d+){0,2}$/;

// Whether `version` is in `range`, for the forms package.json uses:
// alternatives joined by ||, each "^X.Y.Z" (same major) or ">=X.Y.Z".
// Any other form throws, so a range this can't read fails the tests
// instead of letting the wrong Node through.
export function satisfies(version, range) {
  const v = parse(version);
  return range.split('||').map((alt) => alt.trim()).some((alt) => {
    if (!ALTERNATIVE.test(alt)) throw new Error(`check-node.js can't read the Node range "${alt}"`);
    const min = parse(alt);
    return alt.startsWith('^') ? v[0] === min[0] && atLeast(v, min) : atLeast(v, min);
  });
}

// "^22.13.0 || >=24" → "22.13+ or 24+"
export function describe(range) {
  return range.split('||').map((alt) => {
    const [major, minor] = parse(alt.trim());
    return minor ? `${major}.${minor}+` : `${major}+`;
  }).join(' or ');
}

export function supportedRange() {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  return pkg.engines.node;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const range = supportedRange();
  if (!satisfies(process.version, range)) {
    console.error([
      '',
      `Tenwise needs Node.js ${describe(range)} (you have ${process.version}).`,
      process.platform === 'win32'
        ? 'Install the current LTS from https://nodejs.org, or with nvm-windows: `nvm install 24` and `nvm use 24`.'
        : 'Install the current LTS from https://nodejs.org, or run `nvm install` in this folder.',
      'Then reinstall the dependencies, which are built for the Node that installed them:',
      '',
      '  npm ci',
      '',
    ].join('\n'));
    process.exit(1);
  }
}
