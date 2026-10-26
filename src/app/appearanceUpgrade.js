import { readStored, writeStored } from '../utils/storage.js';
import { READER_SETTINGS_STORAGE_KEY } from '../utils/readerSettings.js';

// One-time moves to new appearance defaults (v2: the "Instrument" look; v3:
// larger reader text). The app saved its appearance on every load, so a
// stored value can't tell a deliberate choice from an old default. Values
// equal to the old defaults are treated as defaults and upgraded; anything
// else was chosen and is kept.

const VERSION_KEY = 'tenwise-appearance-version';

const OLD_TO_NEW = [
  { key: 'tenwise-font', from: 'sans', to: 'plex' },
  { key: 'tenwise-color', from: 'emerald', to: 'amber' },
  { key: 'tenwise-view-mode', from: 'magazine', to: 'rows' },
];

// Rewrites the saved reader settings with `change`, if any are saved.
function updateReaderSettings(storage, change) {
  const raw = readStored(READER_SETTINGS_STORAGE_KEY, null, storage);
  if (!raw) return;
  try {
    const settings = JSON.parse(raw);
    writeStored(READER_SETTINGS_STORAGE_KEY, JSON.stringify({ ...settings, ...change(settings) }), storage);
  } catch { /* unreadable settings fall back to defaults anyway */ }
}

// v2: IBM Plex Sans, amber, Newsreader in the reader, the Rows view.
function toInstrument(storage) {
  for (const { key, from, to } of OLD_TO_NEW) {
    if (readStored(key, null, storage) === from) writeStored(key, to, storage);
  }
  writeStored('tenwise-font-stack', '', storage); // recomputed from the font on first render
  updateReaderSettings(storage, (s) => (s.fontFamily === 'sans' ? { fontFamily: 'newsreader' } : {}));
}

// v3: reader text from 16px to 18px, which suits Newsreader in a 700px column.
function toLargerReaderText(storage) {
  updateReaderSettings(storage, (s) => (s.fontSize === 16 ? { fontSize: 18 } : {}));
}

const STEPS = [
  { version: 2, run: toInstrument },
  { version: 3, run: toLargerReaderText },
];

/** Upgrades saved appearance settings that are still the old defaults. Each step runs once. */
export function upgradeAppearanceDefaults(storage = globalThis.localStorage) {
  const from = Number(readStored(VERSION_KEY, '0', storage)) || 0;
  const pending = STEPS.filter((step) => step.version > from);
  if (pending.length === 0) return;
  for (const step of pending) step.run(storage);
  writeStored(VERSION_KEY, pending.at(-1).version, storage);
}
